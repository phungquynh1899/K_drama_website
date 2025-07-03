sequenceDiagram
    participant User
    participant Client
    participant Server

    User->>Client: Login (username/password)
    Client->>Server: POST /login
    Server->>Server: Verify credentials
    Server-->>Client: Access Token (JWT), Refresh Token

    loop API Requests
        Client->>Server: GET /protected (with Access Token)
        Server->>Server: Verify JWT (public key)
        alt Valid
            Server-->>Client: Data
        else Expired
            Server-->>Client: 401 Unauthorized
        end
    end

    alt Access Token Expired
        Client->>Server: POST /refresh (with Refresh Token)
        Server->>Server: Verify Refresh Token
        Server-->>Client: New Access Token (JWT)
    end

    User->>Client: Logout
    Client->>Server: POST /logout
    Server->>Server: Delete Refresh Token