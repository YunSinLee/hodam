# 호담 (HODAM) - AI 동화 생성 서비스

AI 기술로 만드는 개인 맞춤형 동화 서비스입니다.

## 🚀 시작하기

### 환경 설정

1. 환경변수 파일 생성

```bash
cp .env.example .env.local
```

2. 필요한 환경변수 설정

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

### Cursor MCP 설정 (선택사항)

AI 개발 도구인 Cursor에서 Supabase MCP를 사용하려면:

1. Supabase 대시보드에서 Personal Access Token 생성
2. `.cursor/mcp.json` 파일 생성:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest", "--access-token"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "your_personal_access_token"
      }
    }
  }
}
```

⚠️ **보안 주의사항**: `.cursor/` 폴더는 `.gitignore`에 포함되어 있어 Git에 추적되지 않습니다.

## 📦 설치

```bash
npm install
npm run dev
```

## 🛠️ 기술 스택

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o-mini
- **Styling**: Tailwind CSS
- **Development**: Cursor with MCP

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다.
