export const VALIDATION_MESSAGES = Object.freeze({
  required: (field) => `${field} is required`,
  minLength: (field, length) => `${field} must be at least ${length} characters`,
  maxLength: (field, length) => `${field} cannot exceed ${length} characters`,
  invalidEmail: 'Please provide a valid email address',
  invalidType: (field, type) => `${field} must be ${type}`,
  invalidOption: (field) => `${field} contains an unsupported value`,
});
