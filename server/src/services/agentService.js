const { asyncTaskQueue } = require('./queueService');
const WorkItem = require('../models/WorkItem');
const WorkItemEvent = require('../models/WorkItemEvent');

let geminiClient = null;

class AgentService {
  static initialize() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const { GoogleGenAI } = require('@google/genai');
        geminiClient = new GoogleGenAI({ apiKey });
        console.log('[AgentService] Gemini AI initialized for autonomous triage.');
      } catch (err) {
        console.warn('[AgentService] Failed to load @google/genai SDK:', err.message);
      }
    } else {
      console.log('[AgentService] GEMINI_API_KEY not set. Using intelligent heuristic inference engine.');
    }

    // Attach worker to resilient queue
    asyncTaskQueue.on('process', async (job) => {
      if (job.name === 'ENRICH_WORK_ITEM') {
        try {
          await AgentService.processWorkItemEnrichment(job.data.workItemId);
          asyncTaskQueue.markCompleted(job.id);
        } catch (err) {
          asyncTaskQueue.markFailed(job.id, err.message || 'AI enrichment failed');
        }
      }
    });
  }

  /**
   * Main agent execution workflow
   */
  static async processWorkItemEnrichment(workItemId) {
    const item = await WorkItem.findById(workItemId);
    if (!item) return;

    // 1. Detect duplicate / overlapping active work items
    const duplicates = await this.detectDuplicates(item);

    // 2. Perform Root-Cause & Next Action Analysis (Gemini LLM or Heuristics)
    let analysisResult;
    if (geminiClient) {
      analysisResult = await this.runGeminiInference(item, duplicates);
    } else {
      analysisResult = this.runHeuristicInference(item, duplicates);
    }

    // 3. Update Work Item atomically with AI insights
    const updated = await WorkItem.findByIdAndUpdate(
      workItemId,
      {
        $set: {
          aiAnalysis: {
            analyzedAt: new Date(),
            modelUsed: geminiClient ? 'gemini-2.5-flash' : 'newtonite-heuristic-v1',
            summary: analysisResult.summary,
            rootCauseHypothesis: analysisResult.rootCauseHypothesis,
            suggestedNextStep: analysisResult.suggestedNextStep,
            recommendedPriority: analysisResult.recommendedPriority,
            duplicateSuspects: duplicates,
            status: 'COMPLETED'
          }
        }
      },
      { new: true }
    );

    if (!updated) return;

    // 4. Create immutable audit event in work_item_events
    await WorkItemEvent.create({
      workItemId: item._id,
      sequenceNumber: updated.version,
      eventType: 'AI_ENRICHED',
      actor: {
        name: 'Newtonite OpsCopilot (AI Agent)',
        email: 'agent@newtonite.internal',
        role: 'AUTONOMOUS_AGENT'
      },
      changes: [
        {
          field: 'aiAnalysis',
          oldValue: null,
          newValue: 'ENRICHED'
        }
      ],
      comment: `Agentic AI analyzed item: ${analysisResult.summary}. Recommended priority: ${analysisResult.recommendedPriority || item.priority}.`,
      metadata: {
        model: geminiClient ? 'gemini-2.5-flash' : 'newtonite-heuristic-v1',
        duplicatesFound: duplicates.length
      }
    });

    // 5. If duplicates found, record duplicate alert event
    if (duplicates.length > 0) {
      await WorkItemEvent.create({
        workItemId: item._id,
        sequenceNumber: updated.version,
        eventType: 'AI_DUPLICATE_FLAGGED',
        actor: {
          name: 'Newtonite Duplicate Detector',
          email: 'agent@newtonite.internal',
          role: 'AUTONOMOUS_AGENT'
        },
        changes: [],
        comment: `Warning: Possible duplicate or related work detected in ${duplicates.map(d => d.itemNumber).join(', ')}.`,
        metadata: { duplicates }
      });
    }

    console.log(`[AgentService] Successfully enriched work item ${item.itemNumber}`);
  }

  /**
   * Search for duplicate or overlapping work items
   */
  static async detectDuplicates(currentItem) {
    const keywords = currentItem.title
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3 && !['with', 'from', 'that', 'this', 'have', 'need', 'issue', 'problem'].includes(w));

    if (keywords.length === 0) return [];

    const regexArray = keywords.slice(0, 3).map(k => new RegExp(k, 'i'));

    const potentialMatches = await WorkItem.find({
      _id: { $ne: currentItem._id },
      status: { $in: ['NEW', 'TRIAGED', 'IN_PROGRESS', 'PENDING_APPROVAL'] },
      $or: [
        { title: { $in: regexArray } },
        { tags: { $in: currentItem.tags } }
      ]
    }).limit(3);

    return potentialMatches.map(m => ({
      workItemId: m._id,
      itemNumber: m.itemNumber,
      title: m.title,
      similarityReason: `Overlapping category (${m.category}) and matching operational symptoms.`
    }));
  }

  /**
   * Call Gemini 2.5 Flash for high-speed analysis
   */
  static async runGeminiInference(item, duplicates) {
    try {
      const prompt = `You are Newtonite's Operational Triage Agent. Analyze this work request:
Title: ${item.title}
Description: ${item.description}
Category: ${item.category}
Current Priority: ${item.priority}
Duplicates: ${JSON.stringify(duplicates)}

Respond ONLY with valid JSON in this format:
{
  "summary": "1-sentence summary of the incident",
  "rootCauseHypothesis": "Most plausible technical or operational failure point",
  "suggestedNextStep": "Specific immediate action for the on-call engineer or operator",
  "recommendedPriority": "LOW" | "MEDIUM" | "HIGH" | "URGENT"
}`;

      const response = await geminiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      const text = response.text || '';
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (err) {
      console.warn('[AgentService] Gemini inference failed, falling back to heuristic engine:', err.message);
      return this.runHeuristicInference(item, duplicates);
    }
  }

  /**
   * Heuristic deterministic inference engine (offline / fallback safe)
   */
  static runHeuristicInference(item, duplicates) {
    const text = `${item.title} ${item.description}`.toLowerCase();
    
    let rootCause = 'Underlying system component or configuration discrepancy.';
    let nextStep = 'Triage request logs and inspect system health dashboards.';
    let recommendedPriority = item.priority;

    if (text.includes('payment') || text.includes('settlement') || text.includes('ach') || text.includes('ledger')) {
      rootCause = 'Reconciliation pipeline discrepancy between internal ledger and payment gateway webhooks.';
      nextStep = 'Query payment transaction audit logs for batch mismatch, verify webhook delivery timestamps.';
      recommendedPriority = 'HIGH';
    } else if (text.includes('memory') || text.includes('oom') || text.includes('crash') || text.includes('pod') || text.includes('timeout')) {
      rootCause = 'Process memory exhaustion or connection pool depletion under peak operational load.';
      nextStep = 'Inspect APM heap profiles, scale container replicas, and check circuit breaker metrics.';
      recommendedPriority = 'URGENT';
    } else if (text.includes('kyc') || text.includes('compliance') || text.includes('sanction') || text.includes('audit')) {
      rootCause = 'Automated screening rule flagged transaction against sanctioned entities list.';
      nextStep = 'Conduct secondary identity verification and obtain Team Lead compliance sign-off.';
      recommendedPriority = 'HIGH';
    }

    if (duplicates.length > 0) {
      nextStep += ` NOTE: Check existing item ${duplicates[0].itemNumber} to avoid split-brain work!`;
    }

    return {
      summary: `Automated triage for ${item.category} request: ${item.title}`,
      rootCauseHypothesis: rootCause,
      suggestedNextStep: nextStep,
      recommendedPriority
    };
  }
}

module.exports = AgentService;

