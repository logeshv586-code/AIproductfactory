# Architecture — AI coding assistant that reads GitHub PRs

## Components
- **Core Engine** (TypeScript): Main processing
- **API Gateway** (Next.js): Request handling
- **Data Layer** (Prisma): Persistence

## Data Flows
- API Gateway → Core Engine: Requests
- Core Engine → Data Layer: State

## Tech Stack
TypeScript, Next.js, Prisma

## Deployment
docker-compose

## Overview
Three-tier architecture with API Gateway, Core Engine, and Data Layer
