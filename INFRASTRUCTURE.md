# 🚀 Modular Infrastructure Migration Guide (One-Pager)

Transition any application from a **Centralized Caddyfile** to **Label-Based Modular Routing**.

---

### **Step 1: Join the Shared Proxy Network**
Add the `caddy_network` to your application's `docker-compose.yml`. This allows the primary proxy to talk to your container without exposing any public ports on the host.

```yaml
networks:
  caddy_network:
    external: true  # This is the shared network created on the server
```

---

### **Step 2: Add Caddy Labels to the Web Service**
Add these 2 specific labels to your main web service (FastAPI, React, Nginx, etc.). 

```yaml
services:
  web: # or your app service name
    networks:
      - default
      - caddy_network
    labels:
      caddy: myapp.cognitrus.ai   # The domain you want
      caddy.reverse_proxy: "{{upstreams 9007}}" # The INTERNAL port your app listens on
```

---

### **Step 3: Internalize Your Port (Agnostic Fix)**
**Remove the `ports:` section** from your app's `docker-compose.yml`. You no longer need to map port 9001, 9002, etc., to the host machine. 

```diff
- ports:
-   - "9001:8000"
```
*Your application is now served solely via the primary proxy, making it port-agnostic and more secure.*

---

### **Summary of Benefits**
1.  **Modular**: Routing rules reside in the application folder, not a central brain.
2.  **Port-Agnostic**: No port conflicts on the host machine.
3.  **Automatic SSL**: Caddy automatically provisions certificates for labels it discovers.
4.  **No Manual Restart**: The primary Caddy reloads automatically when you run `docker-compose up -d` on your app.

---

### **Verification**
After running `docker compose up -d`, check the primary proxy logs:
```bash
docker logs multiple-stores-dashboard-caddy-1 --tail 50
```
*Look for "Successfully configured" and your domain in the list.*
