const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    avatarUrl: { type: String },
    globalRole: { 
      type: String, 
      enum: ['ADMIN', 'OPERATOR', 'VIEWER'], 
      default: 'OPERATOR' 
    },
    teams: [
      {
        teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
        role: { 
          type: String, 
          enum: ['MEMBER', 'TEAM_LEAD', 'ADMIN'], 
          default: 'MEMBER' 
        }
      }
    ],
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);

