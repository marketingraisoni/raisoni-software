import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { USER_TYPES, USER_TYPE, USER_STATUSES, USER_STATUS } from '../constants/user.js';
import { VALIDATION_MESSAGES } from '../constants/validationMessages.js';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from '../constants/permissions.js';

const permissionSchema = new mongoose.Schema({
  module: {
    type: String,
    enum: PERMISSION_MODULES,
    required: true
  },
  actions: [{
    type: String,
    enum: PERMISSION_ACTIONS
  }]
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, VALIDATION_MESSAGES.required('Name')],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    username: {
      type: String,
      required: [true, VALIDATION_MESSAGES.required('Username')],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters']
    },
    email: {
      type: String,
      required: [true, VALIDATION_MESSAGES.required('Email')],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, VALIDATION_MESSAGES.invalidEmail]
    },
    password: {
      type: String,
      required: [true, VALIDATION_MESSAGES.required('Password')],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false // Excluded by default from queries for security
    },
    userType: {
      type: Number,
      enum: {
        values: USER_TYPES,
        message: 'User type is invalid'
      },
      default: USER_TYPE.STAFF,
      index: true
    },
    // Retained temporarily so existing databases can be migrated safely.
    role: {
      type: String,
      select: false
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: USER_STATUS.ACTIVE
    },
    notes: {
      type: String,
      default: ''
    },
    lastLogin: {
      type: Date
    },
    permissions: {
      type: [permissionSchema],
      default: undefined
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model('User', userSchema);
