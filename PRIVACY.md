# Política de Privacidade — Minha Agenda

Última atualização: 2026-08-22

Este documento descreve como o aplicativo **Minha Agenda** coleta, utiliza,
armazena e protege os dados pessoais dos seus usuários, em conformidade com a
Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).

O mesmo aviso é exibido na tela de login (`src/app/pages/login/login.component.html`)
e espelhado aqui de forma expandida.

## 1. Controlador dos dados

- **Controlador**: Minha Agenda
- **Contato**: entre em contato com o controlador para exercer seus direitos
  (ver Seção 6).

## 2. Finalidade do tratamento

Os dados de perfil fornecidos pelo Google são tratados com a finalidade
**exclusiva de identificação e personalização** da sua experiência dentro do
aplicativo (ex.: reconhecer sua conta, exibir seu nome e imagem, adaptar o
conteúdo à sua preferência). Não há finalidade secundária, comercialização de
dados ou perfilamento para terceiros.

## 3. Dados coletados

No momento do login via Google (OAuth 2.0), coletamos apenas as seguintes
informações de perfil:

- **Nome** (fornecido pelo Google)
- **E-mail** (fornecido pelo Google)
- **Imagem de perfil** (fornecida pelo Google)

Nenhum dado adicional é solicitado ao Google (escopo `openid email profile`).
Não armazenamos o refresh token do Google, apenas o perfil lido no login.

## 4. Transferência internacional de dados (LGPD Art. 33)

Seus dados são armazenados em um banco de dados **CockroachDB hospedado nos
Estados Unidos** (CockroachDB Cloud, região `gcp-us-central1`).

Isso caracteriza uma **transferência internacional de dados pessoais** para
país cujo nível de proteção de dados possa ser diverso do brasileiro, conforme
o **Art. 33 da LGPD**. O controlador adota medidas de segurança (criptografia
em trânsito via TLS `sslmode=verify-full`, acesso restrito por chave e
autenticação) para mitigar riscos dessa transferência.

## 5. Retenção dos dados

Os dados pessoais são mantidos:

- Enquanto sua **conta estiver ativa**; e
- Por até **30 (trinta) dias** após uma eventual exclusão da conta, para fins
  de recuperação e cumprimento de obrigações legais.

Após esse prazo, os dados são removidos definitivamente.

## 6. Direitos do titular (LGPD Arts. 16 e 18)

Você pode, a qualquer momento, exercer seus direitos de:

- **Acesso** aos seus dados;
- **Correção** de dados incompletos, inexatos ou desatualizados;
- **Eliminação** dos dados tratados com base no seu consentimento (Art. 16);
- **Revogação do consentimento** (Art. 18), sem prejuízo da licitude do
  tratamento realizado até então.

Para exercer esses direitos, entre em contato com o controlador. A exclusão
da conta pode ser feita diretamente pelo próprio aplicativo por meio do
endpoint:

```
DELETE /api/auth/account
```

Esse endpoint remove sua conta e todos os dados associados (`user_data`,
removidos em cascata), conforme o Art. 16 da LGPD.

## 7. Registro de consentimento

O consentimento é registrado no momento do login. Ao concluir o fluxo de
autenticação OAuth, o servidor persiste a data/hora do consentimento no campo
**`consent_at`** da tabela **`users`** (via `UsersRepository.saveConsent`,
chamado no callback de login — `server/src/auth/auth.controller.ts`).

Esse `consent_at` é o **registro de consentimento** exigido pela LGPD e
comprova a aceitação do aviso de privacidade no ato do login. Nenhuma alteração
de código foi necessária para este registro; ele já existe e está operante.

## 8. Endurecimento de origem (Cloudflare)

Como medida de segurança opcional de infraestrutura, recomenda-se expor o
backend exclusivamente por meio de um túnel Cloudflare e restringir o acesso
à origem para que **apenas a Cloudflare possa alcançá-la**. Duas etapas
complementares são descritas no runbook do túnel
(`docs/cloudflare-tunnel.md`, Task 19):

1. **Authenticated Origin Pulls (AOP)**: a origem exige um certificado
   cliente da Cloudflare em toda requisição TLS, garantindo que somente a
   Cloudflare (e não um cliente direto) consiga estabelecer conexão com o
   servidor de origem.
2. **Bot Fight Mode**: ativa a mitigação automática de tráfego de bots
   proveniente da Cloudflare antes que ele chegue à origem.

Combinadas, essas medidas asseguram que o servidor de origem não receba
tráfego que não tenha passado previamente pelo proxy da Cloudflare, reduzindo
a superfície de ataque direto (bypass de WAF, varredura de porta, etc.).

## 9. Alterações desta política

O controlador pode atualizar esta política periodicamente. A versão vigente
estará sempre disponível neste arquivo (`PRIVACY.md`) na raiz do repositório.
