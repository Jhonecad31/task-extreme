# Instalación de Task Extreme en tu VPS

Guía para Ubuntu 24.04 LTS con un dominio o subdominio propio. Si tu VPS ya tiene Nginx, Apache, Traefik, Plesk o servicios en 80/443, consulta la alternativa de proxy al final; no arranques Caddy sobre esos puertos ocupados.

## 1. Preparar VPS, dominio y GitHub

1. Crea un registro DNS **A** de `tareas.tudominio.com` hacia la IPv4 pública del VPS. Usa AAAA solo si tu IPv6 está configurada. Durante la instalación, utiliza DNS directo, sin proxy de terceros.
2. Permite TCP 80 y 443 y tu puerto SSH en el firewall del proveedor. Caddy usará 80/443 para obtener y renovar el certificado. UDP 443 es opcional para HTTP/3.
3. Instala Docker Engine y el plugin Docker Compose siguiendo la guía oficial de Ubuntu: https://docs.docker.com/engine/install/ubuntu/. Esta guía usa `docker compose` (Compose v2).
4. Instala Git y herramientas básicas:

```bash
sudo apt update
sudo apt install -y git curl unzip
sudo docker version
sudo docker compose version
```

Si usas UFW, permite **primero tu puerto SSH real**. Para SSH en el puerto habitual 22:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

No abras el puerto 3000 ni un puerto de base de datos en Internet.

Sube primero el código a tu repositorio privado usando el README. En el VPS configura una clave de despliegue SSH de solo lectura para ese repositorio, y después:

```bash
sudo mkdir -p /opt/task-extreme
sudo chown "$USER":"$USER" /opt/task-extreme
git clone git@github.com:TU_USUARIO/task-extreme.git /opt/task-extreme
cd /opt/task-extreme
```

Si no usarás GitHub todavía, puedes subir el ZIP con SCP, descomprimirlo y colocar su contenido en `/opt/task-extreme`. Los archivos `compose.yml` y `Dockerfile` deben quedar directamente en esa carpeta.

## 2. Configurar las conexiones

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

Ejemplo: cambia los valores por los tuyos, **sin inventar una contraseña en este archivo**:

```dotenv
APP_ORIGIN=https://tareas.tudominio.com
INITIAL_ADMIN_EMAIL=tu-correo@empresa.com
DOMAIN=tareas.tudominio.com
TLS_EMAIL=tu-correo@empresa.com
SESSION_HOURS=12
NODE_ENV=production
```

| Variable/conexión | Valor y función |
| --- | --- |
| `APP_ORIGIN` | URL exacta que abrirán los usuarios, con `https://`, sin ruta ni barra final. Se usa para cookies, redirecciones y protección de origen. |
| `DOMAIN` | Mismo host, sin `https://`. Caddy obtiene el certificado para él. |
| `TLS_EMAIL` | Correo de contacto para la emisión del certificado HTTPS. |
| `INITIAL_ADMIN_EMAIL` | Correo inicial del único administrador. Su contraseña se crea en terminal. Después, el correo vigente se lee de su perfil. |
| `SESSION_HOURS` | Duración máxima de una sesión, de 1 a 168 horas. Valor sugerido: 12. |
| `DB_PATH` | En Docker queda fijado a `/app/data/task-extreme.sqlite`; el volumen `task_data` persiste ese archivo. Para ejecución sin Docker usa la ruta de tu `.env`. |
| `HOST`, `PORT` | Dentro de Docker: `0.0.0.0:3000`. No se publica ese puerto al exterior. |
| `TRUST_PROXY` | Compose lo fija a `1` porque solo Caddy accede al servicio interno. No lo habilites en un servidor expuesto directamente a Internet. |
| SMTP | No requerido. Tú entregas las credenciales temporales y restableces accesos. No hay recuperación pública por correo. |

## 3. Crear la base de datos y tu cuenta principal

**La base de datos se crea automáticamente**. No tienes que crear usuarios SQL, contraseñas SQL ni ejecutar `CREATE DATABASE`. SQLite es un archivo local; el servidor aplica en orden las migraciones de `drizzle/` y registra cuáles ya ejecutó.

Prepara la carpeta de respaldos. La aplicación Docker se ejecuta como UID 1000:

```bash
mkdir -p backups
sudo chown 1000:1000 backups
sudo chmod 700 backups
sudo docker compose build
sudo docker compose run --rm --no-deps app npm run init-admin
```

La terminal te pedirá correo, nombre y contraseña (dos veces). La contraseña debe tener de **12 a 128 caracteres**, no se muestra ni se guarda en texto plano. Se crea un único principal; ejecutar el comando de nuevo no crea otro administrador.

Se crea el volumen persistente `task-extreme_task_data`. Dentro de él se conservan:

- `nexo_state`: empresas, espacios, proyectos, tareas/subtareas, perfiles, roles, grupos, campos y papelera.
- `nexo_updates`, `nexo_files`, `nexo_filechunks`: conversaciones y archivos.
- `taskextreme_audit` y su índice FTS5: log de actividades.
- `vps_credentials`, `vps_sessions`, `vps_login_limits`: hashes de contraseñas, sesiones e intentos de acceso.
- Tablas auxiliares de versiones, cuentas y migraciones.

No cambies las tablas ni las contraseñas directamente con SQL. Usa las opciones de administración de la herramienta.

## 4. Iniciar y comprobar

```bash
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=80 app caddy
curl -I https://tareas.tudominio.com/login
```

Abre **https://tareas.tudominio.com**. Inicia sesión manualmente con tu correo y contraseña. Tu dashboard será el del administrador principal. La instalación comienza sin datos de demostración; crea tu primera empresa y sus espacios.

Caddy gestiona y renueva HTTPS. Si falla el certificado, revisa DNS, puertos 80/443, posibles registros AAAA incorrectos y que ningún otro servidor ocupe esos puertos.

## 5. Dar de alta a los demás usuarios

Solo tú, como administrador principal:

1. En **Usuarios y permisos**, agrega el nombre del usuario.
2. Edita su perfil y registra su correo. Cada correo y nombre deben ser únicos.
3. Asigna el rol **gerente** o **agente**, sus empresas y espacios. No puede existir un segundo principal.
4. En **Equipos y grupos**, configura los agentes concretos del gerente o sus grupos. Un gerente sin agentes/grupos solo ve su propia información.
5. En **Accesos y contraseñas**, selecciona al usuario, establece una contraseña temporal y confírmala.
6. Entrega al usuario la URL, su correo y la contraseña temporal por un canal privado. Al entrar debe reemplazarla antes de usar la plataforma.

No hay botón ni endpoint de registro público. Los gerentes y agentes no crean cuentas ni cambian roles. Todos pueden cambiar su propia contraseña desde **Cambiar mi contraseña**. Tú puedes restablecer la de otros desde **Accesos y contraseñas**; eso cierra sus sesiones existentes y exige un nuevo cambio.

Eliminar un usuario revoca sus sesiones y credenciales. Si lo restauras desde la papelera, vuelve a habilitar su acceso. Si cambia su correo en el perfil, ese pasa a ser su nuevo correo de acceso; su contraseña sigue vinculada al mismo usuario.

### Recuperar tu propia contraseña principal

Necesitas acceso SSH al VPS. Este comando no crea otro principal, cambia el acceso del existente y queda registrado:

```bash
cd /opt/task-extreme
sudo docker compose run --rm --no-deps app npm run reset-admin
```

## 6. Respaldar y restaurar

El respaldo SQLite incluye **todo**, también archivos adjuntos, usuarios, hashes de contraseñas, sesiones y log. Protégelo y guarda copias fuera del VPS. No lo subas al repositorio.

Respaldo consistente, incluso con el servicio funcionando:

```bash
sudo docker compose run --rm --no-deps app npm run backup
sudo ls -lh backups
```

No copies el archivo SQLite activo con `cp`: utiliza `npm run backup`, que tiene en cuenta WAL. Una copia de `task-extreme.sqlite` sin su WAL mientras está en uso puede perder cambios.

Ejemplo de cron diario para root; créalo con `sudo crontab -e`:

```cron
0 3 * * * cd /opt/task-extreme && /usr/bin/docker compose run --rm --no-deps app npm run backup >> /var/log/task-extreme-backup.log 2>&1
```

La hora es la del VPS. Para 03:00 de Cancún configura su zona horaria como `America/Cancun` o ajusta el cron. Este ejemplo no borra respaldos automáticamente. Implementa una retención y una copia cifrada en otro equipo según tu espacio disponible.

Para restaurar, sustituye el nombre por un respaldo real. **Detén primero la aplicación**:

```bash
sudo docker compose stop app
sudo docker compose run --rm --no-deps app node vps/restore.mjs /app/backups/task-extreme-FECHA.sqlite --confirm-offline
sudo docker compose up -d
```

El restaurador valida el archivo y guarda un respaldo previo antes de sustituir la DB. Después, las cuentas, contraseñas, permisos y sesiones son los del respaldo restaurado. En una recuperación por incidente, restablece las contraseñas necesarias.

No uses `docker compose down -v`: **elimina los volúmenes y con ellos la base de datos y los certificados**. `docker compose down` sin `-v` conserva los volúmenes.

## 7. Actualizar desde GitHub

```bash
cd /opt/task-extreme
sudo docker compose run --rm --no-deps app npm run backup
git pull --ff-only
sudo docker compose build
sudo docker compose up -d
sudo docker compose logs --tail=80 app
```

Las nuevas migraciones se aplican al iniciar. No sobrescribas tu `.env` con la plantilla al actualizar. Conserva los respaldos de la versión anterior. Antes de regresar a una versión antigua, verifica compatibilidad de sus migraciones o restaura su respaldo.

## 8. Importar datos de monday.com o de la versión anterior

El ZIP es una entrega de código con instalación limpia. No mueve automáticamente los registros ni archivos de la versión alojada anterior. Para monday.com, usa **Importar Excel** con tu cuenta principal y revisa el mapeo de usuarios, estados y fechas antes de confirmar. Los usuarios creados al importar no reciben acceso hasta que tú registres su correo y habilites su contraseña.

El Excel solo trae la información exportada por monday.com. No puede traer conversaciones, fotos o archivos que no estén incluidos en él. Si necesitas transferir también la DB completa del sitio alojado anterior, hay que extraer sus registros y adjuntos y hacer una migración validada; no mezcles una DB de Cloudflare sin las tablas de autenticación VPS.

## 9. Si ya tienes proxy o panel en tu VPS

No ejecutes el servicio `caddy`. Crea `compose.proxy.yml`:

```yaml
services:
  app:
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      TRUST_PROXY: "0"
```

Después:

```bash
sudo docker compose -f compose.yml -f compose.proxy.yml up -d app
```

Configura en tu proxy existente el subdominio y certificado HTTPS, con destino `http://127.0.0.1:3000`. Conserva `APP_ORIGIN=https://tareas.tudominio.com`. Permite cuerpos de 22 MB y SSE sin buffering ni caché; timeout de lectura de al menos 60 segundos. Con `TRUST_PROXY=0` los límites por IP verán la IP del proxy; mantenlo así hasta configurar una red de confianza específica. No publiques `3000:3000` en todas las interfaces.

Para Nginx, el bloque de proxy necesita como mínimo:

```nginx
client_max_body_size 22m;
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 75s;
}
```

El certificado, el bloque `server_name` y la redirección HTTP→HTTPS los configura tu panel o Certbot. Para los siguientes comandos de operación usa siempre los mismos archivos Compose (`-f compose.yml -f compose.proxy.yml`) y levanta solo `app`.
