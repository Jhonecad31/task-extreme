# Instalar Task Extreme en Ubuntu con Apache

Task Extreme usa HTML, CSS y JavaScript en el navegador, Node.js 24 y SQLite en el servidor. Apache recibe HTTPS y reenvía las solicitudes a Node.js por `127.0.0.1:3000`. Docker conserva los datos en el volumen `task_data`, incluidos los adjuntos. Usa una sola instancia y deja espacio para SQLite y sus respaldos.

## 1. Dominio, DNS y firewall

Crea un registro A para `task.extremegroup.info` con la IPv4 pública del VPS. Añade AAAA si tienes IPv6 operativa. Permite TCP 80 y 443 y conserva el acceso a tu puerto SSH. El puerto 3000 queda en loopback.

Instala Docker Engine y Compose v2 según la [guía oficial para Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Con Apache ya instalado:

```bash
sudo apt update
sudo apt install -y git curl certbot python3-certbot-apache
sudo a2enmod proxy proxy_http headers setenvif ssl alias
sudo docker compose version
```

Clona el repositorio autorizado en `/opt/task-extreme` o copia el código allí. Para un repositorio privado puedes usar una clave de despliegue SSH de solo lectura. Ejecuta los comandos siguientes desde `/opt/task-extreme`.

## 2. Configurar y arrancar la aplicación

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

Configura `APP_ORIGIN=https://task.extremegroup.info`, sin barra final, y `INITIAL_ADMIN_EMAIL=admin@tudominio.com` con tu correo. Compose selecciona producción, usa sesiones de 12 horas por defecto y limita el puerto de la aplicación al equipo local. Las contraseñas se introducen en terminal o en la interfaz. La aplicación crea SQLite y aplica las migraciones al iniciar.

```bash
mkdir -p backups
sudo chown 1000:1000 backups
sudo chmod 700 backups
sudo docker compose config --quiet
sudo docker compose build
sudo docker compose run --rm --no-deps app npm run init-admin
sudo docker compose up -d app
sudo docker compose ps
curl -fsS http://127.0.0.1:3000/healthz
```

La contraseña inicial se solicita en terminal y debe tener de 12 a 128 caracteres. La instalación comienza con un único principal y sin datos de ejemplo.

## 3. Emitir el certificado y habilitar el proxy

Si Apache ya tiene un certificado para el subdominio, usa sus rutas en el VirtualHost. Para emitir uno con Certbot, crea primero un VirtualHost HTTP mínimo:

```bash
sudo tee /etc/apache2/sites-available/task-extreme.conf >/dev/null <<'EOF'
<VirtualHost *:80>
    ServerName task.extremegroup.info
</VirtualHost>
EOF
sudo a2ensite task-extreme
sudo apache2ctl configtest
sudo systemctl reload apache2
sudo certbot certonly --apache -d task.extremegroup.info
```

Si ese dominio ya tiene un VirtualHost administrado por un panel, incorpora allí las directivas del proxy.

```bash
sudo install -m 644 deploy/apache/task-extreme.conf /etc/apache2/sites-available/task-extreme.conf
sudo a2ensite task-extreme
sudo apache2ctl configtest
sudo systemctl reload apache2
curl -fsS https://task.extremegroup.info/healthz
curl -I http://task.extremegroup.info/login
curl -I https://task.extremegroup.info/login
sudo certbot renew --dry-run
```

Las respuestas deben incluir `X-Robots-Tag: noindex, nofollow`. Mantén la página de inicio de sesión accesible para que Google pueda leer `noindex`. Un bloqueo general en `robots.txt` impediría que Google vea el encabezado. El contenido privado sigue protegido por el inicio de sesión. [Documentación de Google](https://developers.google.com/search/docs/crawling-indexing/block-indexing)

Si Certbot gestiona el certificado, añade un hook de despliegue para que Apache cargue el certificado renovado:

```bash
sudo install -d /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/task-extreme-apache >/dev/null <<'EOF'
#!/bin/sh
systemctl reload apache2
EOF
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/task-extreme-apache
```

Abre el sitio e inicia sesión. Para comprobar SSE en producción, abre las herramientas de red del navegador y comprueba que `/api/live` recibe eventos. Cambia el estado de una tarea en otra sesión autorizada y verifica que la vista original se actualice.

## 4. Administrar cuentas

En **Usuarios y permisos**, crea perfiles y configura su rol, empresa y espacios. En **Equipos y grupos**, asigna el alcance de los gerentes. En **Accesos y contraseñas**, configura la contraseña temporal. El usuario debe cambiarla en su primer acceso. Restablecerla revoca sus sesiones. Editar el correo cambia el identificador de acceso y conserva la cuenta. Restaurar un usuario recupera su perfil y relaciones. El principal debe habilitar sus credenciales de nuevo.

Para recuperar la cuenta principal desde SSH:

```bash
sudo docker compose run --rm --no-deps app npm run reset-admin
```

## 5. Respaldar, restaurar y actualizar

El respaldo consistente incluye SQLite, adjuntos, credenciales, sesiones y auditoría. Usa el comando de respaldo aunque la app esté en ejecución, ya que SQLite utiliza WAL. Almacena copias cifradas fuera del VPS.

```bash
sudo docker compose run --rm --no-deps app npm run backup
sudo ls -lh backups
```

Para restaurar, sustituye el nombre del archivo por un respaldo real. El restaurador valida la copia y guarda un respaldo previo. Se recuperan también las credenciales y sesiones presentes en la copia. Restablece las credenciales afectadas tras un incidente.

```bash
sudo docker compose stop app
sudo docker compose run --rm --no-deps app node vps/restore.mjs /app/backups/task-extreme-FECHA.sqlite --confirm-offline
sudo docker compose up -d app
```

Para actualizar desde Git, genera primero un respaldo y conserva `.env`:

```bash
sudo docker compose run --rm --no-deps app npm run backup
git pull --ff-only
sudo docker compose up -d --build app
sudo docker compose logs --tail=80 app
curl -fsS https://task.extremegroup.info/healthz
```

`docker compose down` conserva el volumen. `docker compose down -v` borra los datos persistentes.

## 6. Alternativa con Nginx o Caddy

En Nginx, usa el siguiente bloque dentro del VirtualHost HTTPS. `X-Forwarded-For` se sobrescribe con la IP determinada por el proxy, como requiere el límite por IP de la aplicación.

```nginx
client_max_body_size 22m;
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 75s;
}
```

Si los puertos 80 y 443 están libres y prefieres Caddy, configura `DOMAIN` y `TLS_EMAIL` en `.env` y ejecuta `sudo docker compose --profile caddy up -d`. En el VPS con Apache usa `sudo docker compose up -d app`.

## 7. Pruebas

Ejecuta `npm test` con Node.js 24. Para repetir la suite en la imagen Linux:

```bash
sudo docker compose build app
sudo docker compose run --rm --no-deps app npm test
```
