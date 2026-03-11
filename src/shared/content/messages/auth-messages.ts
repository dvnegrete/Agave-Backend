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
// PASSWORD RESET MESSAGES
// ============================================================================

export const PasswordResetMessages = {
  RESET_EMAIL_SENT:
    'Si el correo está registrado, recibirás un enlace de recuperación.',
  PASSWORD_CHANGED: 'Contraseña actualizada exitosamente.',
  USER_NOT_FOUND:
    'Si el correo está registrado, recibirás un enlace de recuperación.',
  CHANGE_FAILED:
    'No fue posible actualizar la contraseña. Por favor intenta nuevamente.',
};

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
