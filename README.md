# Task Extreme · VPS

Plataforma para empresas, espacios de trabajo, proyectos, tareas y subtareas. Incluye responsables múltiples, comentarios y adjuntos, columnas configurables, vistas de listado/Kanban/línea de tiempo/Gantt, dashboards por rol, grupos, búsqueda, modo noche, importación de Excel de monday.com, papelera y log administrativo.

**Acceso por correo y contraseña. Solo existe un administrador principal. Solo él crea los usuarios, define roles y permisos y habilita sus credenciales. No hay registro público.** Los gerentes ven los agentes/grupos autorizados; los agentes ven sus actividades y los contenidos autorizados por su grupo. Las comprobaciones se realizan en el servidor.

## Entrega y arquitectura

- Node.js 24 LTS (mínimo 24.13) y SQLite con FTS5, incluidos en la imagen Docker.
- Sin dependencias npm de ejecución. SheetJS Community está incluido con su licencia para Excel.
- Base SQLite persistente: empresas, tareas, perfiles, permisos, grupos, comentarios, adjuntos, credenciales, sesiones y auditoría. **No requiere MySQL, PostgreSQL, Redis, R2 ni conexión a ChatGPT.**
- Notificaciones y actualizaciones mediante Server-Sent Events (SSE). Caddy hace de proxy HTTPS.
- Contraseñas con scrypt y sal individual; sesiones aleatorias guardadas como hash, cookies HttpOnly y Secure en producción, comprobación de origen, límites de intentos y auditoría sin contraseñas.
- El código conserva el núcleo de permisos probado de la versión anterior; `vps/` lo ejecuta con SQLite y autenticación local. Los nombres internos `nexo_*` de algunas tablas son compatibilidad técnica; el producto se llama Task Extreme.
- Instalación limpia: un principal y ninguna tarea/empresa de ejemplo. `tests/demo-seed.json` es exclusivamente un fixture de pruebas. **El ZIP contiene código, no los datos de tu sitio alojado ni sus contraseñas.**

Guía completa: **[INSTALACION-VPS.md](docs/INSTALACION-VPS.md)**. Incluye DNS, HTTPS, creación de la DB, variables/conexiones, alta de cuentas, respaldo, restauración y actualizaciones.

## Prueba local sin Docker

Instala Node.js 24 LTS desde https://nodejs.org/ y verifica `node --version`.

```bash
cp .env.example .env
# Edita INITIAL_ADMIN_EMAIL; conserva APP_ORIGIN=http://localhost:3000 y NODE_ENV=development.
npm run build
npm run init-admin
npm start
```

Abre http://localhost:3000 e ingresa con el correo y contraseña que acabas de crear. La contraseña se solicita en terminal sin mostrarse; nunca la pongas en un comando ni en Git. No ejecutes `init-admin` otra vez para añadir usuarios: los demás se crean dentro de la aplicación.

```bash
npm test
```

Las pruebas usan bases temporales y verifican autenticación, exclusividad del principal, permisos, aislamiento, revocación, comentarios/archivos, recuperación, dashboard, Excel, búsqueda y tema.

## Subir a tu GitHub

Crea un repositorio **privado vacío**, sin README automático, en tu cuenta de GitHub. Descomprime la entrega y abre terminal en la carpeta que contiene este archivo:

```bash
git init -b main
git add .
git commit -m "Initial Task Extreme VPS release"
git remote add origin git@github.com:TU_USUARIO/task-extreme.git
git push -u origin main
```

Configura tu clave SSH de GitHub antes de hacer push, o usa la autenticación oficial de GitHub CLI. Sustituye `TU_USUARIO` y el nombre del repositorio. No subas `.env`, `data/`, `backups/`, bases de datos ni claves: `.gitignore` ya los excluye. Este paquete no contiene un remoto configurado ni credenciales de GitHub.

En el VPS usa una clave SSH de despliegue con permiso de **solo lectura** para clonar el repositorio privado. No publiques las contraseñas de los usuarios en GitHub.

## Estructura

```text
web/             Interfaz completa y formularios de acceso
worker/          API, permisos, grupos, papelera y auditoría
vps/             Servidor HTTP, SQLite, sesiones y utilidades de operación
drizzle/         Migraciones SQL ordenadas, aplicadas automáticamente
scripts/         Compilación y pruebas del producto
tests/           Pruebas de autenticación y fixtures
Dockerfile       Imagen sin dependencias npm externas
compose.yml      Aplicación, volumen de datos y Caddy
Caddyfile        HTTPS y proxy con soporte SSE
.env.example     Plantilla de configuración, sin contraseñas
```

## Alcance operativo

Esta entrega mantiene el almacenamiento del prototipo: el estado principal se guarda como un documento JSON versionado en SQLite; comentarios, archivos, sesiones y auditoría tienen tablas separadas. Límite actual del estado: **1.500.000 caracteres**; hasta 10.000 elementos por colección. Adjuntos: **20 MB por archivo**, hasta 10 por comentario; se guardan en fragmentos base64 en la DB. Excel importa lo que exista en el archivo; los adjuntos/comentarios que monday.com no exporte no pueden recuperarse del Excel.

Recomendado para un VPS de una sola instancia: 2 GB RAM como punto de partida, 2 vCPU y SSD con espacio para datos y respaldos. El consumo real depende del uso y los adjuntos. No arranques varias réplicas ni pongas esta SQLite sobre NFS. Para crecimiento elevado o múltiples servidores, el siguiente trabajo es normalizar el estado en PostgreSQL y mover archivos a almacenamiento de objetos; eso no está implementado en esta entrega.

La auditoría está protegida contra modificación/eliminación por SQL y no se expone a gerentes/agentes. El propietario con acceso root al VPS puede modificar el software o los archivos: no es un sistema de auditoría externo a prueba del administrador del servidor.

No hay envío SMTP ni recuperación pública: los restablecimientos los realiza el administrador. Los avisos en vivo requieren tener abierta la aplicación; no son correos ni notificaciones móviles push.
