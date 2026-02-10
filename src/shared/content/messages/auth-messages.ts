/**
 * Auth Messages
 * Centralized authentication validation and error messages in Spanish
 */

// ============================================================================
// VALIDATION MESSAGES - Used in class-validator decorators
// ============================================================================

export const AuthValidationMessages = {
  // Email validation
  EMAIL_INVALID: 'El correo electrónico debe ser válido',

  // Password validation
  PASSWORD_REQUIRED: 'La contraseña debe ser un texto válido',
  PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 6 caracteres',

  // Name validation
  FIRST_NAME_INVALID: 'El nombre debe ser un texto válido',
  LAST_NAME_INVALID: 'El apellido debe ser un texto válido',

  // House number validation
  HOUSE_NUMBER_REQUIRED_FORMAT: 'El número de casa debe ser un número entero',
  HOUSE_NUMBER_MIN: (min: number) =>
    `El número de casa debe ser mayor o igual a ${min}`,
  HOUSE_NUMBER_MAX: (max: number) =>
    `El número de casa debe ser menor o igual a ${max}`,

  // Provider validation
  PROVIDER_INVALID: 'El proveedor debe ser un texto válido',

  // Token validation
  REFRESH_TOKEN_INVALID: 'El token de refresco debe ser un texto válido',
  ACCESS_TOKEN_INVALID: 'El token de acceso debe ser un texto válido',
};

// ============================================================================
// SIGNUP MESSAGES
// ============================================================================

export const SignUpMessages = {
  SUCCESS: 'Cuenta creada exitosamente',
  ACCOUNT_CREATION_FAILED:
    'No fue posible crear la cuenta. Por favor intenta nuevamente.',
  EMAIL_ALREADY_REGISTERED:
    'Este correo electrónico ya está registrado. Por favor usa otro.',
};

// ============================================================================
// SIGNIN MESSAGES
// ============================================================================

export const SignInMessages = {
  INVALID_CREDENTIALS: 'Correo o contraseña inválidos',
  AUTH_FAILED:
    'No se pudo completar la autenticación. Por favor intenta nuevamente.',
  USER_NOT_FOUND:
    'El usuario no existe en el sistema. Por favor regístrate primero.',
};

// ============================================================================
// OAUTH MESSAGES
// ============================================================================

export const OAuthMessages = {
  INVALID_TOKEN:
    'El token de acceso del proveedor no es válido. Por favor intenta de nuevo.',
  CALLBACK_FAILED: 'Ocurrió un error durante la autenticación con el proveedor',
  SIGNIN_FAILED: 'No se pudo iniciar el proceso de autenticación',
};

// ============================================================================
// SESSION MESSAGES
// ============================================================================

export const SessionMessages = {
  TOKEN_EXPIRED: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
  REFRESH_TOKEN_EXPIRED:
    'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
  REFRESH_FAILED:
    'No se pudo refrescar la sesión. Por favor inicia sesión nuevamente.',
  INVALID_TOKEN: 'Tu token no es válido. Por favor inicia sesión nuevamente.',
  SIGNOUT_FAILED: 'No se pudo cerrar la sesión',
  CURRENT_USER_FETCH_FAILED: 'No se pudo obtener la información del usuario',
  REFRESH_TOKEN_FAILED: 'No se pudo refrescar el token',
};

// ============================================================================
// SUPABASE ERROR MAPPING
// Maps Supabase error messages to Spanish user-friendly messages
// ============================================================================

export const SupabaseErrorMap: Record<string, string> = {
  // User/Email errors
  'User already registered': SignUpMessages.EMAIL_ALREADY_REGISTERED,
  'Invalid login credentials': SignInMessages.INVALID_CREDENTIALS,
  'Email not confirmed':
    'Tu correo no ha sido confirmado. Revisa tu bandeja de entrada.',
  'Invalid email': AuthValidationMessages.EMAIL_INVALID,

  // Password errors
  'Password too short': AuthValidationMessages.PASSWORD_TOO_SHORT,
  'Password should be at least 8 characters':
    'La contraseña debe tener al menos 8 caracteres.',
  'Password should be at least 6 characters':
    'La contraseña debe tener al menos 6 caracteres.',
  'Password should contain at least one uppercase letter':
    'La contraseña debe contener al menos una letra mayúscula.',
  'Password should contain at least one number':
    'La contraseña debe contener al menos un número.',
  'Password should contain at least one special character':
    'La contraseña debe contener al menos un carácter especial.',

  // Token errors
  'Token expired': SessionMessages.TOKEN_EXPIRED,
  'Invalid token': SessionMessages.INVALID_TOKEN,
  'Refresh token invalid': SessionMessages.REFRESH_FAILED,

  // General errors
  'User not found': SignInMessages.USER_NOT_FOUND,
  'Access denied': 'Acceso denegado. Por favor intenta de nuevo.',
  Unauthorized: 'No autorizado. Por favor inicia sesión nuevamente.',
};

/**
 * Maps Supabase error message to Spanish user-friendly message
 * @param errorMessage - Error message from Supabase
 * @returns Translated message or original if no match found
 */
export function mapSupabaseErrorToSpanish(errorMessage: string): string {
  // Check for exact match first
  if (SupabaseErrorMap[errorMessage]) {
    return SupabaseErrorMap[errorMessage];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(SupabaseErrorMap)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // Default fallback
  return (
    errorMessage ||
    'Ocurrió un error durante la autenticación. Por favor intenta nuevamente.'
  );
}

// ============================================================================
// GENERIC ERROR MESSAGES
// ============================================================================

export const GenericErrorMessages = {
  AUTH_SERVICE_UNAVAILABLE:
    'El servicio de autenticación no está disponible. Por favor intenta más tarde.',
  INTERNAL_ERROR: 'Error interno del servidor',
  OPERATION_FAILED:
    'No se pudo completar la operación. Por favor intenta nuevamente.',
};
