import { z } from 'zod'

/**
 * Mobile number regex:
 * Matches 10 to 12 digits (numeric only).
 */
export const MOBILE_NUMBER_REGEX = /^[0-9]{10,12}$/
export const MOBILE_REGEX = MOBILE_NUMBER_REGEX

export const MOBILE_VALIDATION_MESSAGE =
  'Mobile number must be between 10 and 12 digits.'

/**
 * Helper to test if a raw string is a valid 10-12 digit mobile number.
 */
export function isValidMobile(mobile?: string | null): boolean {
  if (!mobile) return false
  return MOBILE_NUMBER_REGEX.test(mobile.trim())
}

/**
 * Zod schema for required mobile number (10 to 12 digits).
 */
export const mobileSchema = z
  .string()
  .trim()
  .regex(MOBILE_NUMBER_REGEX, MOBILE_VALIDATION_MESSAGE)

/**
 * Zod schema for optional mobile number.
 * Accepts undefined or empty string. If provided, must be 10 to 12 digits.
 */
export const optionalMobileSchema = z
  .string()
  .trim()
  .regex(MOBILE_NUMBER_REGEX, MOBILE_VALIDATION_MESSAGE)
  .optional()
  .or(z.literal(''))
