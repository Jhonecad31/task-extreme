# Verificación de la entrega

Se verificaron los siguientes recorridos con bases de datos temporales y el código real:

- Correo y contraseña manuales, sin registro público; creación/restablecimiento de accesos exclusivo del principal.
- Cambio obligatorio de contraseña temporal, recuperación principal por terminal, sesiones con hash y cookies seguras, rechazo de identidades externas falsificadas y de solicitudes con otro origen.
- Revocación por cierre de sesión, restablecimiento y eliminación de usuario; persistencia al reiniciar.
- Aislamiento entre empresas, grupos, agentes y gerentes; comentarios, archivos, subtareas, campos, papelera y restauración.
- Auditoría de operaciones y cambios de acceso sin almacenar contraseñas ni tokens en el log.
- HTTP real: subida multipart, comentario, descarga de archivo y notificación SSE tras modificar una tarea.
- Respaldo SQLite mientras la aplicación está activa; restauración offline con adjuntos, credenciales y auditoría.
- Interfaz con instalación vacía; dashboards, importación XLSX real, buscador por fragmentos, modo noche persistente y Gantt con fechas de tareas en distintos meses.
- Compilación Docker con Node.js 24 y ejecución de la suite como usuario sin privilegios. Configuración Compose validada.

Comando reproducible: `npm test`. Docker: `docker build -t task-extreme .` y `docker run --rm --network none task-extreme npm test`.

No se ha accedido a tu VPS ni a tu repositorio de GitHub. DNS, emisión del certificado HTTPS y conexiones concretas de tu servidor deben comprobarse al desplegar. La entrega no incluye datos de producción del sitio alojado. Las pruebas de interfaz utilizan un adaptador DOM; no sustituyen una revisión visual en tu navegador.
