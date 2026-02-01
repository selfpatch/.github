# 🤖 selfpatch

**✨ Open infrastructure for self-healing robots and software-defined machines.**

selfpatch is an open, practical attempt to build the missing "nervous system" for robots and SDVs:
diagnostics, introspection, and update flows that are good enough for humans *and* for AI agents to reason about.

This GitHub organization hosts the open-source core and experiments around that idea.

---

## 🎯 Vision

Modern robots and SDVs run on complex stacks:

- ROS 2 graphs, nodes, topics, actions
- Mixed hardware (MCUs, ECUs, edge HPC, cloud)
- Many protocols (DDS, Zenoh, WebSockets, Iceoryx, UDS, OPC UA, CAN/J1939, …)

Yet diagnostics and updates are often:

- Fragmented per vendor / per subsystem
- Hard to introspect at runtime
- Designed for humans clicking through tools, not for automation or AI

**selfpatch** aims to change that by providing:

1. **A modern diagnostic & introspection layer**
   - Runtime discovery of components, apps, topics, health, configuration
   - API-first approach: HTTP/REST + schemas instead of ad-hoc scripts

2. **A foundation for safe self-healing flows**
   - Clear, machine-readable model of the system
   - Hooks for health checks, mitigation actions, and OTA-style updates
   - Designed so that AI agents can *understand* and *justify* their actions

3. **Bridges instead of rewrites**
   - Integrations with existing ecosystems (ROS 2, UDS, SOVD, OPC UA, …)
   - Evolution over revolution: start where your robots are today.

---

## 🚀 Projects

| Repository | Description | Status |
|------------|-------------|--------|
| [ros2_medkit](https://github.com/selfpatch/ros2_medkit) | SOVD-compatible REST gateway for ROS 2 diagnostics | [![CI](https://github.com/selfpatch/ros2_medkit/actions/workflows/ci.yml/badge.svg)](https://github.com/selfpatch/ros2_medkit/actions/workflows/ci.yml) |
| [sovd_web_ui](https://github.com/selfpatch/sovd_web_ui) | React web UI for browsing SOVD entity trees | [![CI](https://github.com/selfpatch/sovd_web_ui/actions/workflows/ci.yml/badge.svg)](https://github.com/selfpatch/sovd_web_ui/actions/workflows/ci.yml) |
| [ros2_medkit_mcp](https://github.com/selfpatch/ros2_medkit_mcp) | Model Context Protocol server for AI agent integration | [![CI](https://github.com/selfpatch/ros2_medkit_mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/selfpatch/ros2_medkit_mcp/actions/workflows/ci.yml) |
| [selfpatch_demos](https://github.com/selfpatch/selfpatch_demos) | Demo integrations (TurtleBot3, Nav2, Sensor Diagnostics) | [![CI](https://github.com/selfpatch/selfpatch_demos/actions/workflows/ci.yml/badge.svg)](https://github.com/selfpatch/selfpatch_demos/actions/workflows/ci.yml) |

---

### [`ros2_medkit`](https://github.com/selfpatch/ros2_medkit) — Core Gateway

**Modern, SOVD-compatible diagnostics for ROS 2 robots** — C++17 gateway exposing the ROS 2 graph via REST API.

**Entity Model (SOVD-aligned):**
| Entity | Maps to | Example |
|--------|---------|---------|
| **Area** | ROS 2 namespace | `/powertrain`, `/navigation` |
| **Component** | Logical grouping | `motor_controller`, `lidar_unit` |
| **Function** | Capability | `localization`, `obstacle_detection` |
| **App** | ROS 2 node | `/nav2/controller_server` |

**Key Features:**
- 🔍 **Runtime Discovery** — Automatically discovers running nodes, topics, services, actions
- 🌐 **REST API** — HTTP endpoints for all entity types, data, operations, configurations
- 📊 **Dynamic Serialization** — Read any ROS 2 message type at runtime (via dynmsg)
- 📡 **Data Access** — Read or publish data over ROS 2 topics via HTTP
- ⚙️ **Configuration** — Get/set ROS 2 parameters through REST
- 🎯 **Operations** — Invoke services and send action goals via HTTP
- ⚠️ **Fault Management** — Unified fault reporting with snapshots capturing system state at fault time
- 📄 **Manifest Support** — Hybrid discovery with YAML manifests for static entity definitions

```bash
# Quick start
ros2 launch ros2_medkit_gateway gateway.launch.py
curl http://localhost:8080/api/v1/areas
```

📖 [Documentation](https://selfpatch.github.io/ros2_medkit/) • 💬 [Discord](https://discord.gg/6CXPMApAyq)

---

### [`sovd_web_ui`](https://github.com/selfpatch/sovd_web_ui) — Web Interface

**Lightweight React SPA for browsing SOVD entity trees** — connects to ros2_medkit gateway and visualizes the diagnostic hierarchy.

**Tech Stack:** React 19 + TypeScript + Vite + TailwindCSS + shadcn/ui + Zustand

**Features:**
- 🌳 **Entity Tree Browser** — Hierarchical navigation with lazy-loading
- 📂 **Virtual Folders** — `data/`, `operations/`, `configurations/` per entity
- 📊 **Topic Viewer** — Real-time data display with QoS information
- ⚙️ **Parameter Editor** — View and modify ROS 2 parameters
- 🎯 **Operation Invoker** — Call services and send action goals from the UI

```bash
# Quick start
docker run -p 8080:80 ghcr.io/selfpatch/sovd_web_ui
# Then connect to your ros2_medkit gateway URL
```

---

### [`ros2_medkit_mcp`](https://github.com/selfpatch/ros2_medkit_mcp) — AI Agent Integration

**Model Context Protocol (MCP) server** wrapping ros2_medkit REST API for LLM tool use.

**Features:**
- 🔗 **Full ros2_medkit gateway coverage** — Discovery, data, operations, configurations, faults
- 🚀 **Dual transport support** — stdio (Claude Desktop) and streamable-http
- 🐳 **Docker support** — Ready-to-use container images on GHCR
- 🔐 **Bearer token authentication** — Optional secure access

Enables AI agents (Claude, GPT, etc.) to:
- 🔍 Discover and query robot components
- 📊 Read and publish sensor data
- ⚙️ Get and set ROS 2 parameters
- 🎯 Execute services and actions
- ⚠️ Monitor and clear faults

```bash
# Start MCP server (stdio)
ROS2_MEDKIT_BASE_URL=http://localhost:8080/api/v1 poetry run ros2-medkit-mcp-stdio

# Or HTTP transport
poetry run ros2-medkit-mcp-http --host 0.0.0.0 --port 8765
```

**Tool Categories:**
- **Discovery**: `sovd_entities_list`, `sovd_entities_get`, `sovd_version`, `sovd_area_components`
- **Data Access**: `sovd_entity_data`, `sovd_entity_topic_data`, `sovd_publish_topic`
- **Operations**: `sovd_list_operations`, `sovd_create_execution`, `sovd_get_execution`, `sovd_cancel_execution`
- **Configuration**: `sovd_list_configurations`, `sovd_get_configuration`, `sovd_set_configuration`
- **Faults**: `sovd_faults_list`, `sovd_faults_get`, `sovd_faults_clear`

---

### [`selfpatch_demos`](https://github.com/selfpatch/selfpatch_demos) — Demo Integrations

**Real-world demonstrations** of ros2_medkit with ROS 2 robots.

**Available Demos:**
| Demo | Description | Status |
|------|-------------|--------|
| [Sensor Diagnostics](https://github.com/selfpatch/selfpatch_demos/tree/main/demos/sensor_diagnostics) | Lightweight sensor demo (no GPU required) | ✅ Ready |
| [TurtleBot3 + Nav2](https://github.com/selfpatch/selfpatch_demos/tree/main/demos/turtlebot3_integration) | Full mobile robot with Nav2 navigation | ✅ Ready |

```bash
# Sensor Diagnostics (fastest - no GPU)
cd demos/sensor_diagnostics
docker compose up
# Open http://localhost:3000 for Web UI

# TurtleBot3 + Nav2 (full navigation stack)
cd demos/turtlebot3_integration
./run-demo.sh
# Gazebo opens, Web UI at http://localhost:3000
```

---

## 🏗️ Architecture

```
┌─────────────────┐                   ┌─────────────────┐
│  sovd_web_ui    │                   │ ros2_medkit_mcp │
│  (React SPA)    │                   │ (MCP for LLMs)  │
└────────┬────────┘                   └────────┬────────┘
         │ HTTP/REST                           │ HTTP/REST
         │ /api/v1/...                         │ /api/v1/...
         └──────────────┐     ┌────────────────┘
                        ▼     ▼
               ┌─────────────────────┐
               │ ros2_medkit_gateway │
               │  (C++ ROS 2 node)   │
               └──────────┬──────────┘
                          │ ROS 2 APIs
               ┌──────────▼──────────┐
               │    ROS 2 System     │
               │ (nodes, topics,     │
               │  services, actions, │
               │  parameters, faults)│
               └─────────────────────┘
```

---

## 👥 Who is this for?

- **Robotics teams using ROS 2** who need better remote diagnostics and observability
- **SDV / mobility engineers** looking to modernize diagnostics without rewriting everything
- **AI/ML engineers** building autonomous diagnostics and remediation with LLMs
- **Tooling & platform teams** building monitoring, OTA, or AI-driven operations
- **Researchers & tinkerers** exploring self-healing, digital twins, and autonomous remediation

If you've ever thought _"we can't safely automate fixes because we don't really understand what's running where"_,
you're in the right place.

---

## 🤝 Contributing

We're actively developing all repositories. You can help by:

- ⭐ Starring the repositories
- 🐛 Opening issues with use-cases, pain points, and ideas
- 💻 Contributing code, docs, or examples
- 🤖 Testing with your own robots and sharing feedback
- 💬 Joining discussions on [Discord](https://discord.gg/6CXPMApAyq)

See individual repository `CONTRIBUTING.md` files for guidelines.

---

## 📬 Contact & Community

- **💬 Discord** — [Join our server](https://discord.gg/6CXPMApAyq) for discussions and support
- **📖 Documentation** — [selfpatch.github.io/ros2_medkit](https://selfpatch.github.io/ros2_medkit/)
- **🐛 Issues** — Open issues in individual repositories
- **📢 Watch** — Star and watch this organization for updates

If you're working on robots, SDV platforms, or tooling and this resonates,
don't hesitate to reach out – collaboration is the whole point of this effort.
