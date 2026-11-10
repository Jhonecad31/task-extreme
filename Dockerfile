FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node . .
RUN node scripts/build.mjs && mkdir -p /app/data /app/backups && chown -R node:node /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DB_PATH=/app/data/task-extreme.sqlite BACKUP_DIR=/app/backups
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","vps/main.mjs"]
