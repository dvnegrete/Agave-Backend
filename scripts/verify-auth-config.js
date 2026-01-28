#!/usr/bin/env node

/**
 * Script de Verificación de Configuración de Autenticación
 *
 * Valida que las variables de entorno estén configuradas correctamente
 * para evitar problemas de autenticación cross-domain.
 *
 * Uso:
 *   node scripts/verify-auth-config.js
 *   npm run verify:auth
 */

require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logHeader(message) {
  log(`\n${'='.repeat(60)}`, colors.bold);
  log(message, colors.bold);
  log('='.repeat(60), colors.bold);
}

// ========================================
// Validaciones
// ========================================

let hasErrors = false;
let hasWarnings = false;

logHeader('🔐 Verificación de Configuración de Autenticación');

// 1. NODE_ENV
logInfo('\n1️⃣  Verificando NODE_ENV...');
const nodeEnv = process.env.NODE_ENV || 'development';
const validEnvs = ['development', 'staging', 'production', 'test'];

if (!validEnvs.includes(nodeEnv)) {
  logWarning(`NODE_ENV="${nodeEnv}" no es estándar. Valores esperados: ${validEnvs.join(', ')}`);
  hasWarnings = true;
} else {
  logSuccess(`NODE_ENV="${nodeEnv}"`);
}

// 2. FRONTEND_URL (CRÍTICO)
logInfo('\n2️⃣  Verificando FRONTEND_URL (CRÍTICO)...');
const frontendUrl = process.env.FRONTEND_URL;

if (!frontendUrl || frontendUrl.trim() === '') {
  logError('FRONTEND_URL no está configurado. Esta variable es OBLIGATORIA.');
  logInfo('   Ejemplos:');
  logInfo('   - Development: FRONTEND_URL=http://localhost:5173');
  logInfo('   - Staging: FRONTEND_URL=https://agave-frontend-staging.up.railway.app');
  logInfo('   - Production: FRONTEND_URL=https://condominioelagave.com.mx');
  hasErrors = true;
} else if (!frontendUrl.startsWith('http://') && !frontendUrl.startsWith('https://')) {
  logError('FRONTEND_URL debe empezar con http:// o https://');
  logInfo(`   Actual: ${frontendUrl}`);
  hasErrors = true;
} else if (frontendUrl.endsWith('/')) {
  logWarning('FRONTEND_URL no debería terminar con /');
  logInfo(`   Actual: ${frontendUrl}`);
  logInfo(`   Recomendado: ${frontendUrl.slice(0, -1)}`);
  hasWarnings = true;
} else {
  logSuccess(`FRONTEND_URL="${frontendUrl}"`);

  // Verificar protocolo vs NODE_ENV
  const isHttps = frontendUrl.startsWith('https://');
  const isProduction = nodeEnv === 'production';
  const isStaging = nodeEnv === 'staging';

  if ((isProduction || isStaging) && !isHttps) {
    logError(`NODE_ENV="${nodeEnv}" requiere HTTPS pero FRONTEND_URL usa HTTP`);
    hasErrors = true;
  }

  if (nodeEnv === 'development' && isHttps) {
    logWarning('NODE_ENV=development pero FRONTEND_URL usa HTTPS (poco común pero OK)');
    hasWarnings = true;
  }
}

// 3. BACKEND_URL (Recomendado para detectar cross-domain)
logInfo('\n3️⃣  Verificando BACKEND_URL (Recomendado)...');
const backendUrl = process.env.BACKEND_URL;

if (!backendUrl || backendUrl.trim() === '') {
  logWarning('BACKEND_URL no está configurado.');
  logInfo('   Sin BACKEND_URL, el sistema asumirá cross-domain (sameSite: none).');
  logInfo('   Esto funciona pero es menos seguro que same-domain.');
  logInfo('   Recomendación: configurar BACKEND_URL para detección automática.');
  logInfo('   Ejemplos:');
  logInfo('   - Development: BACKEND_URL=http://localhost:3000');
  logInfo('   - Staging: BACKEND_URL=https://agave-backend-staging.up.railway.app');
  logInfo('   - Production: BACKEND_URL=https://agave-backend-production.up.railway.app');
  hasWarnings = true;
} else if (!backendUrl.startsWith('http://') && !backendUrl.startsWith('https://')) {
  logError('BACKEND_URL debe empezar con http:// o https://');
  logInfo(`   Actual: ${backendUrl}`);
  hasErrors = true;
} else if (backendUrl.endsWith('/')) {
  logWarning('BACKEND_URL no debería terminar con /');
  logInfo(`   Actual: ${backendUrl}`);
  logInfo(`   Recomendado: ${backendUrl.slice(0, -1)}`);
  hasWarnings = true;
} else {
  logSuccess(`BACKEND_URL="${backendUrl}"`);
}

// 4. Análisis Cross-Domain
if (frontendUrl && backendUrl) {
  logInfo('\n4️⃣  Analizando configuración cross-domain...');

  const frontendHostname = frontendUrl.replace(/^https?:\/\//, '').split(':')[0];
  const backendHostname = backendUrl.replace(/^https?:\/\//, '').split(':')[0];

  // Extraer dominio base
  function extractBaseDomain(hostname) {
    const parts = hostname.split('.');
    if (parts.length <= 1) return hostname;

    // TLDs de dos niveles
    if (['mx', 'uk', 'br', 'au', 'jp'].includes(parts[parts.length - 1])) {
      return parts.slice(-3).join('.');
    }

    return parts.slice(-2).join('.');
  }

  const frontendBaseDomain = extractBaseDomain(frontendHostname);
  const backendBaseDomain = extractBaseDomain(backendHostname);
  const isSameDomain = frontendBaseDomain === backendBaseDomain;

  logInfo(`   Frontend hostname: ${frontendHostname}`);
  logInfo(`   Backend hostname:  ${backendHostname}`);
  logInfo(`   Frontend base domain: ${frontendBaseDomain}`);
  logInfo(`   Backend base domain:  ${backendBaseDomain}`);

  if (isSameDomain) {
    logSuccess(`✅ Same-domain detectado: ${frontendBaseDomain}`);
    logSuccess('   → Cookies usarán sameSite: lax (más seguro)');
  } else {
    logWarning(`⚠️  Cross-domain detectado`);
    logInfo('   → Cookies usarán sameSite: none (requiere HTTPS)');
    logInfo('   → Sistema usará Authorization header como fallback');

    // Verificar que ambos usan HTTPS en cross-domain
    if (!frontendUrl.startsWith('https://') || !backendUrl.startsWith('https://')) {
      logError('Cross-domain requiere HTTPS en ambos (frontend y backend)');
      hasErrors = true;
    }
  }
}

// 5. JWT Configuration
logInfo('\n5️⃣  Verificando JWT Configuration...');
const jwtSecret = process.env.JWT_SECRET;
const jwtAccessExpires = process.env.JWT_ACCESS_EXPIRES_IN;
const jwtRefreshExpires = process.env.JWT_REFRESH_EXPIRES_IN;

if (!jwtSecret) {
  logError('JWT_SECRET no está configurado');
  hasErrors = true;
} else if (jwtSecret.length < 32) {
  logWarning('JWT_SECRET es muy corto (recomendado: al menos 32 caracteres)');
  hasWarnings = true;
} else {
  logSuccess('JWT_SECRET configurado');
}

if (!jwtAccessExpires) {
  logWarning('JWT_ACCESS_EXPIRES_IN no está configurado (usará default)');
  hasWarnings = true;
} else {
  logSuccess(`JWT_ACCESS_EXPIRES_IN="${jwtAccessExpires}"`);
}

if (!jwtRefreshExpires) {
  logWarning('JWT_REFRESH_EXPIRES_IN no está configurado (usará default)');
  hasWarnings = true;
} else {
  logSuccess(`JWT_REFRESH_EXPIRES_IN="${jwtRefreshExpires}"`);
}

// 6. Firebase Configuration
logInfo('\n6️⃣  Verificando Firebase Configuration...');
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!firebaseProjectId) {
  logError('FIREBASE_PROJECT_ID no está configurado');
  hasErrors = true;
} else {
  logSuccess(`FIREBASE_PROJECT_ID="${firebaseProjectId}"`);
}

if (!firebaseClientEmail) {
  logError('FIREBASE_CLIENT_EMAIL no está configurado');
  hasErrors = true;
} else {
  logSuccess('FIREBASE_CLIENT_EMAIL configurado');
}

if (!firebasePrivateKey) {
  logError('FIREBASE_PRIVATE_KEY no está configurado');
  hasErrors = true;
} else if (!firebasePrivateKey.includes('BEGIN PRIVATE KEY')) {
  logWarning('FIREBASE_PRIVATE_KEY no parece tener el formato correcto');
  logInfo('   Debe contener: -----BEGIN PRIVATE KEY-----');
  hasWarnings = true;
} else {
  logSuccess('FIREBASE_PRIVATE_KEY configurado');
}

// 7. Database Configuration
logInfo('\n7️⃣  Verificando Database Configuration...');
const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;

if (!databaseUrl) {
  logError('DATABASE_URL no está configurado');
  hasErrors = true;
} else if (!databaseUrl.startsWith('postgresql://')) {
  logWarning('DATABASE_URL no parece ser una URL PostgreSQL válida');
  hasWarnings = true;
} else {
  logSuccess('DATABASE_URL configurado');
}

if (!directUrl) {
  logWarning('DIRECT_URL no está configurado (necesario para migraciones)');
  hasWarnings = true;
} else {
  logSuccess('DIRECT_URL configurado');
}

// 8. COOKIE_DOMAIN (Opcional)
logInfo('\n8️⃣  Verificando COOKIE_DOMAIN (Opcional)...');
const cookieDomain = process.env.COOKIE_DOMAIN;

if (!cookieDomain) {
  logInfo('   COOKIE_DOMAIN no configurado (OK en la mayoría de casos)');
  logInfo('   Solo necesario si quieres compartir cookies entre subdominios');
  logInfo('   Ejemplo: COOKIE_DOMAIN=.condominioelagave.com.mx');
} else if (!cookieDomain.startsWith('.')) {
  logWarning('COOKIE_DOMAIN debería empezar con . para compartir entre subdominios');
  logInfo(`   Actual: ${cookieDomain}`);
  logInfo(`   Recomendado: .${cookieDomain}`);
  hasWarnings = true;
} else {
  logSuccess(`COOKIE_DOMAIN="${cookieDomain}"`);
  logInfo('   Cookies se compartirán entre subdominios de este dominio');
}

// ========================================
// Resumen Final
// ========================================

logHeader('📊 Resumen de Verificación');

if (hasErrors) {
  logError('\n❌ Se encontraron errores críticos que deben corregirse.');
  logInfo('\nRevisa los mensajes arriba y corrige las variables de entorno.');
  logInfo('Documentación: /agave-backend/CROSS_DOMAIN_AUTH_SETUP.md');
  process.exit(1);
} else if (hasWarnings) {
  logWarning('\n⚠️  Configuración funcional, pero hay advertencias.');
  logInfo('\nLa aplicación debería funcionar, pero revisa las advertencias para');
  logInfo('mejorar la seguridad y evitar problemas futuros.');
  logInfo('Documentación: /agave-backend/CROSS_DOMAIN_AUTH_SETUP.md');
  process.exit(0);
} else {
  logSuccess('\n✅ ¡Configuración perfecta! No se encontraron problemas.');
  logInfo('\nTu aplicación está correctamente configurada para autenticación.');
  logInfo('Documentación: /agave-backend/CROSS_DOMAIN_AUTH_SETUP.md');
  process.exit(0);
}
