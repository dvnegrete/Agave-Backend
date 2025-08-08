# 🏗️ El Agave Backend

Sistema backend robusto y escalable construido con NestJS para autenticación y procesamiento de transacciones bancarias con una arquitectura extensible basada en modelos (Strategy).

## 🚀 Características Principales

- 🔐 **Autenticación Completa**: Sistema de autenticación con Supabase, OAuth y JWT
- 💰 **Procesamiento de Transacciones Bancarias**: Carga, validación y procesamiento multi-formato (XLSX, CSV, TXT, JSON)
- 🧩 **Arquitectura Extensible (Strategy)**: Modelos de extracto por banco/formato mediante `BankStatementModel` (ej. `SantanderXlsx`)
- 🧱 **Principios SOLID**: Separación de responsabilidades y dependencias por abstracciones
- 📊 **Validaciones Robustas**: Sistema de validación con reglas de negocio
- 🛡️ **Seguridad**: Mejores prácticas de seguridad
- 📈 **Escalable**: Arquitectura modular preparada para crecimiento
- 🧪 **Testing**: Pruebas unitarias por módulo y E2E

## 📚 Documentación

### 📖 [Documentación Completa](./docs/README.md)
Accede a toda la documentación organizada del proyecto.

### 🔐 [Módulo de Autenticación](./docs/modules/auth/README.md)
Sistema completo de autenticación y autorización.

### 💰 [Módulo de Transacciones Bancarias](./docs/modules/transactions-bank/README.md)
Procesamiento de archivos bancarios y exportación.

### 🔗 [API Documentation](./docs/api/README.md)
Documentación completa de todos los endpoints.

### 📖 [Guías de Desarrollo](./docs/guides/README.md)
Guías paso a paso para configuración y desarrollo.

### 💡 [Ejemplos de Uso](./docs/examples/README.md)
Ejemplos prácticos y casos de uso reales.

## 🏗️ Estructura del Proyecto

```
src/
├── auth/                         # Módulo de autenticación
│   ├── controllers/
│   ├── services/
│   ├── guards/
│   ├── decorators/
│   └── dto/
├── transactions-bank/            # Módulo de transacciones bancarias
│   ├── controllers/
│   ├── services/
│   ├── models/                   # BankStatementModel, model-resolver, SantanderXlsx
│   ├── dto/
│   └── interfaces/
├── common/                       # Utilidades y constantes compartidas
├── config/                       # Configuración
└── main.ts                       # Punto de entrada
```

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+ 
- npm o yarn
- Cuenta de Supabase

### Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/your-org/agave-backend.git
cd agave-backend
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp env.example .env
# Editar .env con tus credenciales de Supabase
```

4. **Ejecutar en desarrollo**
```bash
npm run start:dev
```

5. **Ejecutar pruebas**
```bash
npm test
```

6. **Probar endpoint raíz**
```bash
curl http://localhost:3000/
# El Agave
```

## 📡 Endpoints Principales

### Autenticación
- `POST /auth/signup` - Registro de usuarios
- `POST /auth/signin` - Inicio de sesión
- `GET /auth/me` - Obtener usuario actual

### Transacciones
- `POST /transactions-bank/upload` - Cargar archivo de transacciones
- `GET /transactions-bank` - Listar transacciones
- `GET /transactions-bank/export/csv` - Exportar a CSV
- `GET /transactions-bank/export/json` - Exportar a JSON

### Raíz de la API
- `GET /` - Devuelve: `El Agave`

## 🛠️ Comandos Disponibles

```bash
# Desarrollo
npm run start:dev          # Servidor de desarrollo
npm run start:debug        # Servidor con debugging
npm run start:prod         # Servidor de producción

# Testing
npm run test               # Ejecutar pruebas
npm run test:watch         # Pruebas en modo watch
npm run test:cov           # Pruebas con cobertura
npm run test:e2e           # Pruebas end-to-end

# Build
npm run build              # Compilar proyecto
npm run format             # Formatear código
npm run lint               # Linting
```

## 🔧 Configuración

### Variables de Entorno

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# App
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

## 🧪 Testing

El proyecto incluye pruebas completas para todos los módulos:

```bash
# Pruebas unitarias
npm test

# Pruebas específicas por módulo
npx jest --runInBand --testPathPattern=auth
npx jest --runInBand --testPathPattern=transactions-bank

# Cobertura de código
npm run test:cov
```

## 📊 Estado del Proyecto

### ✅ Módulos Implementados
- [x] **Auth**: Sistema completo de autenticación
- [x] **Transactions Bank**: Procesamiento de transacciones con modelos de extracto

### 🚧 En Desarrollo
- [ ] **Users**: Gestión de usuarios y perfiles
- [ ] **Reports**: Generación de reportes

### 📋 Planificados
- [ ] **Notifications**: Sistema de notificaciones
- [ ] **Audit**: Logs de auditoría
- [ ] **Payments**: Integración con pasarelas de pago


## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 🆘 Soporte

- 📧 **Email**: backend@elagave.com
- 💬 **Slack**: #backend-support
- 🐛 **Issues**: [GitHub Issues](https://github.com/your-org/agave-backend/issues)

## 🙏 Agradecimientos

- [NestJS](https://nestjs.com/) - Framework de backend
- [Supabase](https://supabase.com/) - Backend as a Service
- [TypeScript](https://www.typescriptlang.org/) - Lenguaje de programación

---

**Versión**: 1.0.1  
**Última actualización**: $(date)  
**Desarrollado con ❤️ por el equipo de El Agave**
