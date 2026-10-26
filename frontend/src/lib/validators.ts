import { z } from 'zod'

/**
 * Mobile number regex:
 * Matches 10 to 12 digits (numeric only).
 */
const MOBILE_NUMBER_REGEX = /^[0-9]{10,12}$/

const MOBILE_VALIDATION_MESSAGE =
  'Mobile number must be between 10 and 12 digits.'

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
