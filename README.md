# Kaizen Clicker API

Backend NestJS para o desafio tecnico Kaizen Clicker.

## Stack

- NestJS
- TypeScript strict
- class-validator/class-transformer
- Prisma 7
- PostgreSQL via Docker

## Setup

```bash
npm install
docker compose up -d
npx prisma migrate dev
npm run start:dev
```

Opcionalmente configure:

```bash
DATABASE_URL="postgresql://kaizen:kaizen@localhost:5432/kaizen_clicker?schema=public"
PORT=3000
CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
```

Por padrao a API libera CORS para o frontend local do Vite em `http://localhost:5173`.

## Endpoints

### POST /scores

Salva a pontuacao do jogador.

```json
{
  "playerName": "Ana",
  "score": 120,
  "elapsedSeconds": 300,
  "requestId": "5e7bd40b-1db0-4b01-8bb2-ff11f971a820",
  "improvements": {
    "fiveS": 1,
    "kanban": 0,
    "pokaYoke": 0,
    "tpm": 0,
    "andon": 0,
    "jidoka": 0,
    "heijunka": 0,
    "justInTime": 0
  }
}
```

Tambem aceita `improvements` como array de objetos com `id`/`name` e `level`.

Regras:

- `requestId` e obrigatorio e idempotente.
- O score so substitui o melhor score se for maior.
- O mesmo `playerName` pode salvar no maximo uma vez a cada 10 segundos.
- Rate limit retorna `429` com header `Retry-After`.
- Score impossivel retorna `422`.

### GET /scores/top?limit=10

Retorna ranking ordenado por score desc. O limite default e 10 e o maximo e 50.

Esse endpoint usa `Cache-Control: no-store`, entao o frontend pode usar polling.

### GET /scores/me?playerName=Ana

Retorna o melhor score do jogador e sua posicao no ranking. Jogador inexistente retorna `404`.

## Anti-cheat

O backend calcula um teto teorico a partir de:

- tempo decorrido;
- estado inicial da fabrica: 1 peca/s, 30% defeitos, 40% OEE;
- niveis de melhorias entre 0 e 5;
- multiplicadores de velocidade;
- reducoes de defeito;
- OEE e reducao de downtime;
- efeito condicional do Just-In-Time quando defeitos ficam abaixo de 5%.

Premissa propositalmente generosa: os niveis finais enviados sao tratados como se estivessem ativos desde o segundo zero. Depois disso a API adiciona margem de 10% e 1 ponto. Isso evita reprovar saves legitimos por diferenca de simulacao no frontend, mas bloqueia pontuacoes impossiveis.

## Scripts uteis

```bash
npm run build
npm run lint
npm run prisma:generate
npm run prisma:migrate
```
