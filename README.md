# Ultron Task Dashboard

TASKS.md를 파싱해서 정적 대시보드 HTML로 변환합니다.

## 사용법

```bash
# TASKS.md 업데이트 후
node build.mjs
# → docs/index.html 생성
```

## 자동 배포

TASKS.md 또는 build.mjs 변경 시 GitHub Actions가 자동으로 빌드 + GitHub Pages 배포합니다.
