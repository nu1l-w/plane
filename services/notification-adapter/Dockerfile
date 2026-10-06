FROM python:3.12-slim
RUN groupadd --gid 10001 adapter && useradd --uid 10001 --gid adapter adapter \
    && mkdir -p /app/data && chown adapter:adapter /app/data
WORKDIR /app
COPY app.py /app/app.py
USER adapter
ENV PYTHONUNBUFFERED=1 QUEUE_DB=/app/data/queue.sqlite3
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "from urllib.request import urlopen; urlopen('http://127.0.0.1:8080/healthz', timeout=3)"
CMD ["python", "app.py"]
