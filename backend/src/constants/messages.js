export const API_MESSAGES = Object.freeze({
  COMMON: Object.freeze({
    SUCCESS: 'Request completed successfully',
    CREATED: 'Resource created successfully',
    UPDATED: 'Resource updated successfully',
    DELETED: 'Resource deleted successfully',
    NOT_FOUND: 'Requested resource was not found',
    VALIDATION_FAILED: 'Validation failed',
    INVALID_PAYLOAD: 'Invalid request payload',
    INTERNAL_ERROR: 'An internal server error occurred',
    DUPLICATE_RECORD: 'A record with the supplied value already exists',
    INVALID_ID: 'The supplied resource ID is invalid',
    RATE_LIMITED: 'Too many requests. Please try again later',
  }),
  AUTH: Object.freeze({
    LOGIN_SUCCESS: 'User logged in successfully',
    LOGOUT_SUCCESS: 'User logged out successfully',
    CURRENT_USER_SUCCESS: 'Current user retrieved successfully',
    PROFILE_UPDATED: 'Profile updated successfully',
    PROFILE_PHOTO_UPDATED: 'Profile picture updated successfully',
    PROFILE_PHOTO_REMOVED: 'Profile picture removed successfully',
    PASSWORD_CHANGED: 'Password changed successfully',
    INVALID_CREDENTIALS: 'Invalid username or password',
    CURRENT_PASSWORD_INVALID: 'Current password does not match',
    REQUIRED: 'Authentication is required',
    TOKEN_MISSING: 'Authentication required. No token provided',
    TOKEN_EXPIRED: 'Token has expired. Please log in again',
    TOKEN_INVALID: 'Invalid authorization token',
    TOKEN_USER_MISSING: 'The user belonging to this token no longer exists',
    ACCOUNT_INACTIVE: 'Your account is inactive. Contact an administrator',
    FORBIDDEN: 'You do not have permission to perform this action',
    LOGIN_RATE_LIMITED:
      'Too many login attempts. Please try again after 15 minutes',
  }),
  USER: Object.freeze({
    LIST_SUCCESS: 'Users retrieved successfully',
    CREATED: 'User account created successfully',
    UPDATED: 'User account updated successfully',
    DELETED: 'User account deleted successfully',
    NOT_FOUND: 'User not found',
    USERNAME_EXISTS: 'Username is already taken',
    EMAIL_EXISTS: 'Email address is already registered',
    ONLY_ADMIN:
      'Cannot demote or deactivate the only active privileged account',
    DELETE_SELF: 'You cannot delete your own logged-in administrator account',
    DELETE_ONLY_ADMIN:
      'Cannot delete the only remaining active privileged account',
  }),
  CUSTOMER: Object.freeze({
    LIST_SUCCESS: 'Customers retrieved successfully',
    RETRIEVED: 'Customer retrieved successfully',
    CREATED: 'Customer created successfully',
    UPDATED: 'Customer updated successfully',
    DELETED: 'Customer deleted successfully',
    NOT_FOUND: 'Customer not found',
    HAS_ORDERS: (count) =>
      `Cannot delete customer with ${count} existing order(s). Set the customer to inactive instead`,
  }),
  PRODUCT: Object.freeze({
    LIST_SUCCESS: 'Products retrieved successfully',
    RETRIEVED: 'Product retrieved successfully',
    CATEGORIES_RETRIEVED: 'Product categories retrieved successfully',
    CREATED: 'Product created successfully',
    UPDATED: 'Product updated successfully',
    DELETED: 'Product deleted successfully',
    NOT_FOUND: 'Product not found',
    IN_USE: (name, count) =>
      `Cannot delete product '${name}' because it is used by ${count} existing order(s)`,
  }),
  ORDER: Object.freeze({
    LIST_SUCCESS: 'Orders retrieved successfully',
    RETRIEVED: 'Order retrieved successfully',
    CREATED: 'Order created successfully',
    NOT_FOUND: 'Order not found',
    IDEMPOTENT: 'Order was already processed',
    CUSTOMER_INACTIVE: 'Cannot place an order for an inactive customer',
    ALREADY_CANCELLED: 'Order is already cancelled and cannot be updated',
    STATUS_UPDATED: (status) => `Order status changed to ${status}`,
    PRODUCT_INACTIVE: (name) =>
      `Product '${name}' is inactive and cannot be ordered`,
    INSUFFICIENT_STOCK: (name, available, requested) =>
      `Insufficient stock for '${name}'. Available: ${available}, requested: ${requested}`,
  }),
  INVENTORY: Object.freeze({
    OVERVIEW_RETRIEVED: 'Inventory overview retrieved successfully',
    LOW_STOCK_RETRIEVED: 'Low-stock products retrieved successfully',
    MOVEMENTS_RETRIEVED: 'Inventory movements retrieved successfully',
    STOCK_ADJUSTED: 'Stock adjusted successfully',
  }),
  DASHBOARD: Object.freeze({
    RETRIEVED: 'Dashboard metrics retrieved successfully',
  }),
  SETTINGS: Object.freeze({
    RETRIEVED: 'Settings retrieved successfully',
    UPDATED: 'Setting updated successfully',
    KEY_REQUIRED: 'Setting key is required',
  }),
  HEALTH: Object.freeze({
    HEALTHY: 'Service is healthy',
  }),
  LOT: Object.freeze({
    LIST_SUCCESS: 'Lots retrieved successfully',
    RETRIEVED: 'Lot retrieved successfully',
    CREATED: 'Lot created successfully',
    UPDATED: 'Lot updated successfully',
    DELETED: 'Lot deleted successfully',
    NOT_FOUND: 'Lot not found',
    KAPAN_EXISTS: 'A lot with this Kapan No already exists',
    ASSORTMENT_INCOMPLETE:
      'Lot can only be closed when packet count and carat weight match the lot totals',
  }),
  PACKET: Object.freeze({
    LIST_SUCCESS: 'Assortment packets retrieved successfully',
    CREATED: 'Packet created successfully',
    UPDATED: 'Packet updated successfully',
    NOT_FOUND: 'Packet not found in this Lot',
    GRADE_CREATED: 'Grade added successfully',
    GRADE_UPDATED: 'Grade pieces updated successfully',
    GRADE_DELETED: 'Grade deleted successfully',
    GRADE_NOT_FOUND: 'Grade not found in this Lot',
    GRADE_EXISTS: 'This grade is already included in the Lot',
    GRADE_REQUIRED:
      'Add this grade with its planned pieces before creating packets',
    GRADE_COMPLETE: 'All planned packets for this grade are already created',
    GRADE_PCS_LIMIT: 'Grade pieces cannot exceed the remaining Lot pieces',
    GRADE_BELOW_CREATED:
      'Grade pieces cannot be less than packets already created for this grade',
    LOT_CLOSED: 'Packets cannot be added to a closed lot',
    PCS_LIMIT: 'Packet count cannot exceed the lot Total PCs',
    CARAT_LIMIT: 'Packet carat weight cannot exceed the lot Total Carat',
    EXPORT_INCOMPLETE:
      'Excel can only be downloaded after all pieces and carat are assorted',
  }),
  PERMISSION: Object.freeze({
    CATALOG_RETRIEVED: 'Permission catalog retrieved successfully',
    RETRIEVED: 'User permissions retrieved successfully',
    UPDATED: 'User permissions updated successfully',
    CANNOT_GRANT: 'You cannot grant permissions that you do not have',
  }),
});

export const resourceNotFoundMessage = (resource) => `${resource} not found`;
