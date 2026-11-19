# Avance de Task Extreme

## Fase 1 · Recuperar y verificar la base

El último commit había eliminado la entrega anterior. Se recuperó el código de ca88a82 sin modificar el historial. La primera ejecución de `npm test` pasó con Node.js 24 en Windows. Cubre instalación vacía, acceso local, permisos por empresa y grupo, papelera, auditoría, Excel, respaldo, restauración, búsqueda, tema, interfaz y HTTP con SSE.

## Fase 2 · VPS Linux con Apache

Se prepararon el VirtualHost, la publicación de Node.js en loopback y la guía para HTTPS, operación y recuperación. Caddy queda bajo un perfil opcional de Compose. Se corrigió la documentación del comportamiento al restaurar una cuenta y se amplió su prueba. La segunda ejecución de `npm test` pasó. Una prueba en Apache 2.4.58 de XAMPP con puertos locales y certificado temporal verificó sintaxis, redirección HTTP a HTTPS, login, cookie Secure, IP del cliente para límites y eventos SSE.

## Límites de la base recuperada

SQLite y el estado JSON versionado requieren una sola instancia. Los límites de tamaño se detallan en el README. La suite prueba la interfaz mediante scripts y los flujos de red mediante HTTP. La comprobación en Linux con Docker quedó configurada en GitHub Actions y pendiente de ejecutar. También queda pendiente el recorrido en un navegador real. El importador procesa el contenido del archivo Excel, pero todavía falta archivar el binario original en el servidor.
