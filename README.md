# Shiplio

**Shiplio** is a high-performance PaaS (Platform as a Service) designed for developers who value speed and a refined terminal experience. It consists of a robust Elixir/Phoenix backend and a specialized Node.js CLI.

---

## Features

* **Unified Auth Flow:** Secure browser-based authentication that bridges the web and terminal.
* **JWT Security:** Powered by Guardian for stateless, secure token management.

---

## Architecture & Auth Flow

Shiplio uses a "Local Loopback" authentication pattern to ensure your credentials never touch the terminal directly in plain text.



1.  **Initiation:** `shiplio login` starts a temporary local server on a random port.
2.  **Handshake:** The CLI opens the browser to the **Auth Bridge** (`/cli/auth`).
3.  **Verification:** User signs in via a secure HEEx-templated form.
4.  **Completion:** The Bridge redirects the user to the local CLI server with a JWT.
5.  **Persistence:** The CLI stores the JWT for all subsequent deployment commands.

---

## Getting Started

### Backend Setup (Engine)
The engine is the heart of Shiplio, handling the database, user sessions, and deployment logic.

1.  **Install dependencies:**
    ```bash
    cd apps/engine
    mix deps.get
    ```
2.  **Configure Database:** Update `config/dev.exs` with your PostgreSQL credentials.
3.  **Setup Database:**
    ```bash
    mix ecto.setup
    ```
4.  **Start Server:**
    ```bash
    mix phx.server
    ```

### CLI Setup
The CLI is the primary interface for managing your Shiplio services.

1.  **Install & Link:**
    ```bash
    cd cli
    pnpm install
    pnpm link
    ```
2.  **Login:**
    ```bash
    shiplio login
    ```

---

## Command Reference

### Authentication

| Command | Description |
|--------|------------|
| `shiplio login` | Opens the browser to authenticate your local machine via the Auth Bridge. |
| `shiplio logout` | Removes the local JWT token and terminates the session. |
| `shiplio whoami` | Displays the email and account details of the currently authenticated user. |

### App Management

| Command | Description |
|--------|------------|
| `shiplio init` | Initializes a new Shiplio project configuration in the current directory. |
| `shiplio deploy` | Bundles and pushes the current project to the Shiplio cloud. |
| `shiplio apps` | Lists all active applications and their current deployment status. |
| `shiplio destroy` | Permanently removes an application and its associated resources. |

### Observability

| Command | Description |
|--------|------------|
| `shiplio logs` | Streams real-time stdout/stderr logs from your running application. |
| `shiplio status` | Shows health metrics, uptime, and resource usage for an app. |

### Configuration

| Command | Description |
|--------|------------|
| `shiplio env:set` | Sets an environment variable or secret for the application. |
| `shiplio env:list` | Lists all environment variables configured for the current app. |
| `shiplio help` | Displays detailed usage information for all available commands. |


---

## License

Copyright © 2026 Shiplio.
Licensed under the MIT License.