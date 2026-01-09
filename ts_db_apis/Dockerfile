FROM python:3.11-slim

WORKDIR /ts_db_apis

COPY ts_db_apis/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Set PYTHONPATH to include container and server paths for utils
ENV PYTHONPATH=/ts_db_apis:/opt/stage/src

COPY ts_db_apis .

EXPOSE 8004

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8004"]
