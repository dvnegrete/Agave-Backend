# 🏗️ El Agave Backend

Sistema backend robusto y escalable construido con NestJS para el procesamiento de transacciones bancarias y gestión de autenticación.

## 🚀 Características Principales

- 🔐 **Autenticación Completa**: Sistema de autenticación con Supabase, OAuth y JWT
- 💰 **Procesamiento de Transacciones**: Carga, validación y procesamiento de archivos bancarios
- 📊 **Validaciones Robustas**: Sistema de validación avanzado con reglas de negocio
- 🛡️ **Seguridad**: Implementación de mejores prácticas de seguridad
- 📈 **Escalable**: Arquitectura modular preparada para crecimiento
- 🧪 **Testing**: Cobertura completa de pruebas unitarias e integración

## 📚 Documentación

### 📖 [Documentación Completa](./docs/README.md)
Accede a toda la documentación organizada del proyecto.

### 🔐 [Módulo de Autenticación](./docs/modules/auth/README.md)
Sistema completo de autenticación y autorización.

### 💰 [Módulo de Vouchers](./docs/modules/vouchers/README.md)
Procesamiento de transacciones bancarias.

### 🔗 [API Documentation](./docs/api/README.md)
Documentación completa de todos los endpoints.

### 📖 [Guías de Desarrollo](./docs/guides/README.md)
Guías paso a paso para configuración y desarrollo.

### 💡 [Ejemplos de Uso](./docs/examples/README.md)
Ejemplos prácticos y casos de uso reales.

## 🏗️ Estructura del Proyecto

```
src/
├── auth/                    # Módulo de autenticación
│   ├── controllers/
│   ├── services/
│   ├── guards/
│   ├── decorators/
│   └── dto/
├── vouchers/               # Módulo de transacciones
│   ├── controllers/
│   ├── services/
│   ├── dto/
│   └── interfaces/
├── config/                 # Configuración
└── main.ts                 # Punto de entrada
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

## 📡 Endpoints Principales

### Autenticación
- `POST /auth/signup` - Registro de usuarios
- `POST /auth/signin` - Inicio de sesión
- `GET /auth/me` - Obtener usuario actual

### Transacciones
- `POST /vouchers/upload` - Cargar archivo de transacciones
- `GET /vouchers` - Listar transacciones
- `GET /vouchers/export/csv` - Exportar a CSV

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
npm test src/auth
npm test src/vouchers

# Cobertura de código
npm run test:cov
```

## 📊 Estado del Proyecto

### ✅ Módulos Implementados
- [x] **Auth**: Sistema completo de autenticación
- [x] **Vouchers**: Procesamiento de transacciones

### 🚧 En Desarrollo
- [ ] **Users**: Gestión de usuarios y perfiles
- [ ] **Reports**: Generación de reportes

### 📋 Planificados
- [ ] **Notifications**: Sistema de notificaciones
- [ ] **Audit**: Logs de auditoría
- [ ] **Payments**: Integración con pasarelas de pago

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

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

**Versión**: 1.0.0  
**Última actualización**: $(date)  
**Desarrollado con ❤️ por el equipo de El Agave**
