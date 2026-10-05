# Fixora

Fixora helps Coimbatore residents find nearby home-service professionals, request a visit, and follow the job from acceptance to completion. Customers can attach up to five problem photos; professionals manage requests and availability; admins review professional verification.

## Demo sign-ins

| Role | Email | Password |
| --- | --- | --- |
| Customer | `customer@fixora.demo` | `demo1234` |
| Professional | `pro01@fixora.demo` | `pro1234` |
| Admin | `admin@fixora.demo` | `admin1234` |

More seeded customer accounts use `customer2@fixora.demo` and `customer3@fixora.demo` with password `demo1234`. Professionals `pro02@fixora.demo` through `pro15@fixora.demo` use password `pro1234`.

## Run

- Start the web app with the `artifacts/fixora: web` workflow.
- Start the API with the `artifacts/api-server: API Server` workflow.
- Run `pnpm run typecheck` to type-check the workspace.

The API seeds the demo accounts, five service categories, 15 professionals around Coimbatore, and example bookings on first start. Uploaded booking photos are stored under the API's local `uploads/` directory for this demo.
