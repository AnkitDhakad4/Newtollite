const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '' },
    leadUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    allowedCategories: {
      type: [String],
      default: [
        'CUSTOMER_ISSUE',
        'INCIDENT',
        'PAYMENT_INVESTIGATION',
        'COMPLIANCE',
        'OPERATIONAL_APPROVAL'
      ]
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Team', TeamSchema);

