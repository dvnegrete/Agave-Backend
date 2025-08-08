# 📚 Documentación - El Agave Backend

## 🏗️ Estructura del Proyecto

```
docs/
├── README.md                 # Este archivo - Índice principal
├── modules/                  # Documentación de módulos
│   ├── README.md            # Índice de módulos
│   ├── auth/                # Módulo de autenticación
│   ├── vouchers/            # Módulo de transacciones bancarias
│   └── [futuros-modulos]/   # Otros módulos por agregar
├── api/                     # Documentación de API
│   ├── README.md            # Índice de APIs
│   ├── endpoints.md         # Todos los endpoints disponibles
│   └── schemas.md           # Esquemas de datos
├── guides/                  # Guías y tutoriales
│   ├── README.md            # Índice de guías
│   ├── setup.md             # Guía de configuración
│   ├── deployment.md        # Guía de despliegue
│   └── development.md       # Guía de desarrollo
└── examples/                # Ejemplos de uso
    ├── README.md            # Índice de ejemplos
    ├── auth-examples.md     # Ejemplos de autenticación
    └── vouchers-examples.md # Ejemplos de transacciones
```

## 🚀 Módulos Disponibles

### 🔐 [Autenticación](./modules/auth/README.md)
Sistema completo de autenticación con Supabase
- Registro e inicio de sesión
- Autenticación OAuth (Google, Facebook, GitHub, etc.)
- Gestión de tokens JWT
- Guards y decoradores de autenticación

### 💰 [Vouchers](./modules/vouchers/README.md)
Procesamiento de transacciones bancarias
- Carga y procesamiento de archivos (CSV, TXT, JSON)
- Validación robusta de transacciones
- Gestión completa de transacciones (CRUD)
- Exportación de datos

## 📖 Guías Rápidas

- [Configuración Inicial](./guides/setup.md)
- [Desarrollo Local](./guides/development.md)
- [Despliegue](./guides/deployment.md)

## 🔗 Enlaces Útiles

- [API Endpoints](./api/endpoints.md)
- [Esquemas de Datos](./api/schemas.md)
- [Ejemplos de Uso](./examples/README.md)

## 📝 Notas de Desarrollo

### Próximos Módulos Planificados
- [ ] **Users**: Gestión de usuarios y perfiles
- [ ] **Reports**: Generación de reportes y analytics
- [ ] **Notifications**: Sistema de notificaciones
- [ ] **Audit**: Logs de auditoría y trazabilidad
- [ ] **Payments**: Integración con pasarelas de pago
- [ ] **Inventory**: Gestión de inventario
- [ ] **Orders**: Gestión de pedidos
- [ ] **Shipping**: Gestión de envíos

### Convenciones de Documentación
- Cada módulo tiene su propia carpeta en `docs/modules/`
- Los archivos README.md sirven como índices
- Usar emojis para mejorar la legibilidad
- Mantener ejemplos prácticos en cada documentación
- Incluir diagramas cuando sea necesario

---

**Última actualización**: $(date)
**Versión**: 1.0.0
