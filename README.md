VCG Web Application (Virtual Communication Gateway)
🌍 Overview
The VCG Web App is the frontend dashboard for the Virtual Communication Gateway project (MI6228). It provides a real-time, interactive interface to monitor, manage, and visualize Distributed Energy Resources (DER) across local energy communities. The application acts as the visual layer for a system built on the IEEE 2030.5 standard, integrated with FIWARE and the IDS Dataspace for secure data sovereignty.

🚀 Features
Arc Reactor Dashboard: A live, animated SVG visualization displaying real-time smart sensor values (Temperature, Humidity, Generation vs. Consumption).

Cross-Device Sync Engine: Utilizes JSONBin for real-time bidirectional syncing, ensuring instant state updates across mobile and desktop clients.

Demand Response (DR) Interface: Allows users to trigger DR events and dynamically calculate energy and cost savings.

Seamless Interoperability: Parses and integrates Group 12's NGSI-LD CSV data and SAREF ontology in real time.

🛠 Tech Stack
Framework: Next.js 14

Library: React

Language: TypeScript

Deployment: Vercel
