import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../backend/src/app.module';
import { setupApp } from '../backend/src/http/setup-app';

const expressApp = express();
const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
setupApp(app);
await app.init();

export default expressApp;
