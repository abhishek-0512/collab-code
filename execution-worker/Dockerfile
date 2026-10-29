FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 \
       openjdk-17-jdk-headless \
       g++ \
       coreutils \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --global tsx \
    && useradd --create-home --uid 10001 runner \
    && mkdir -p /workspace \
    && chown runner:runner /workspace

USER runner
WORKDIR /workspace

ENV HOME=/home/runner
ENV PATH=/usr/local/bin:/usr/bin:/bin

CMD ["node", "--version"]
