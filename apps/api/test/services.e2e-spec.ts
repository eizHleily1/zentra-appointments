import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AUTH_REPOSITORY } from "../src/auth/auth.repository";
import { PostgresAuthRepository } from "../src/auth/postgres-auth.repository";
import { BUSINESS_HOURS_REPOSITORY } from "../src/businesses/business-hours.repository";
import { PostgresBusinessHoursRepository } from "../src/businesses/postgres-business-hours.repository";
import { BUSINESS_REPOSITORY } from "../src/businesses/business.repository";
import { PostgresBusinessRepository } from "../src/businesses/postgres-business.repository";
import { SERVICE_REPOSITORY } from "../src/services/service.repository";
import { PostgresServiceRepository } from "../src/services/postgres-service.repository";
import { InMemoryAuthRepository } from "./in-memory-auth.repository";
import { InMemoryBusinessHoursRepository } from "./in-memory-business-hours.repository";
import { InMemoryBusinessRepository } from "./in-memory-business.repository";
import { InMemoryServiceRepository } from "./in-memory-service.repository";

describe("ServicesController", () => {
  let app: INestApplication;
  let serviceRepository: InMemoryServiceRepository;

  beforeEach(async () => {
    serviceRepository = new InMemoryServiceRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(new InMemoryAuthRepository())
      .overrideProvider(PostgresAuthRepository)
      .useValue({})
      .overrideProvider(BUSINESS_REPOSITORY)
      .useValue(new InMemoryBusinessRepository())
      .overrideProvider(PostgresBusinessRepository)
      .useValue({})
      .overrideProvider(BUSINESS_HOURS_REPOSITORY)
      .useValue(new InMemoryBusinessHoursRepository())
      .overrideProvider(PostgresBusinessHoursRepository)
      .useValue({})
      .overrideProvider(SERVICE_REPOSITORY)
      .useValue(serviceRepository)
      .overrideProvider(PostgresServiceRepository)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true
      })
    );
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it("creates, lists, views, updates, and deactivates services for a business member", async () => {
    const accessToken = await registerAndGetAccessToken(app, "owner@example.com");
    const business = await createBusiness(app, accessToken, "Owner Business");
    const createdService = await createService(app, accessToken, business.id, {
      description: "Classic haircut",
      durationMinutes: 30,
      name: "Haircut",
      price: 15
    });

    expect(createdService).toMatchObject({
      active: true,
      businessId: business.id,
      description: "Classic haircut",
      durationMinutes: 30,
      name: "Haircut",
      price: 15
    });

    const listResponse = await request(app.getHttpServer())
      .get(`/businesses/${business.id}/services`)
      .set("authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].id).toBe(createdService.id);

    await request(app.getHttpServer())
      .get(`/businesses/${business.id}/services/${createdService.id}`)
      .set("authorization", `Bearer ${accessToken}`)
      .expect(200);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/businesses/${business.id}/services/${createdService.id}`)
      .set("authorization", `Bearer ${accessToken}`)
      .send({ description: "Updated", durationMinutes: 45, name: "Premium Haircut", price: 25 })
      .expect(200);

    expect(updateResponse.body).toMatchObject({
      description: "Updated",
      durationMinutes: 45,
      name: "Premium Haircut",
      price: 25
    });

    const deactivateResponse = await request(app.getHttpServer())
      .post(`/businesses/${business.id}/services/${createdService.id}/deactivate`)
      .set("authorization", `Bearer ${accessToken}`)
      .expect(201);

    expect(deactivateResponse.body.active).toBe(false);
    expect(serviceRepository.getServices()).toHaveLength(1);
  });

  it("prevents users without business access from accessing or modifying services", async () => {
    const ownerToken = await registerAndGetAccessToken(app, "owner@example.com");
    const otherToken = await registerAndGetAccessToken(app, "other@example.com");
    const business = await createBusiness(app, ownerToken, "Owner Business");
    const createdService = await createService(app, ownerToken, business.id, {
      description: "Classic haircut",
      durationMinutes: 30,
      name: "Haircut",
      price: 15
    });

    await request(app.getHttpServer())
      .get(`/businesses/${business.id}/services`)
      .set("authorization", `Bearer ${otherToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/businesses/${business.id}/services/${createdService.id}`)
      .set("authorization", `Bearer ${otherToken}`)
      .send({ name: "Unauthorized" })
      .expect(404);
  });

  it("keeps services scoped to their owning business", async () => {
    const accessToken = await registerAndGetAccessToken(app, "owner@example.com");
    const firstBusiness = await createBusiness(app, accessToken, "First Business");
    const secondBusiness = await createBusiness(app, accessToken, "Second Business");
    const firstService = await createService(app, accessToken, firstBusiness.id, {
      description: "First",
      durationMinutes: 30,
      name: "First Service",
      price: 10
    });

    await request(app.getHttpServer())
      .get(`/businesses/${secondBusiness.id}/services/${firstService.id}`)
      .set("authorization", `Bearer ${accessToken}`)
      .expect(404);
  });

  it("rejects invalid service input and unauthenticated creation", async () => {
    const accessToken = await registerAndGetAccessToken(app, "owner@example.com");
    const business = await createBusiness(app, accessToken, "Owner Business");

    await request(app.getHttpServer())
      .post(`/businesses/${business.id}/services`)
      .send({ description: "No auth", durationMinutes: 30, name: "No Auth", price: 15 })
      .expect(401);

    await request(app.getHttpServer())
      .post(`/businesses/${business.id}/services`)
      .set("authorization", `Bearer ${accessToken}`)
      .send({ description: "Invalid", durationMinutes: 0, name: "Invalid", price: -1 })
      .expect(400);
  });

  it("rejects duplicate active service names and allows reuse after deactivation", async () => {
    const accessToken = await registerAndGetAccessToken(app, "owner@example.com");
    const business = await createBusiness(app, accessToken, "Owner Business");
    const createdService = await createService(app, accessToken, business.id, {
      description: "Classic haircut",
      durationMinutes: 30,
      name: "Haircut",
      price: 15
    });

    await request(app.getHttpServer())
      .post(`/businesses/${business.id}/services`)
      .set("authorization", `Bearer ${accessToken}`)
      .send({ description: "Duplicate", durationMinutes: 30, name: " haircut " })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/businesses/${business.id}/services/${createdService.id}/deactivate`)
      .set("authorization", `Bearer ${accessToken}`)
      .expect(201);

    const listAfterDeactivate = await request(app.getHttpServer())
      .get(`/businesses/${business.id}/services`)
      .set("authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(listAfterDeactivate.body).toEqual([]);

    const recreatedService = await createService(app, accessToken, business.id, {
      description: "New haircut",
      durationMinutes: 30,
      name: "Haircut",
      price: 20
    });

    expect(recreatedService).toMatchObject({
      active: true,
      name: "Haircut",
      price: 20
    });
  });

  it("allows creating a service without a price", async () => {
    const accessToken = await registerAndGetAccessToken(app, "owner@example.com");
    const business = await createBusiness(app, accessToken, "Owner Business");

    const response = await request(app.getHttpServer())
      .post(`/businesses/${business.id}/services`)
      .set("authorization", `Bearer ${accessToken}`)
      .send({ description: "Free consultation", durationMinutes: 30, name: "Consultation" })
      .expect(201);

    expect(response.body).toMatchObject({
      name: "Consultation",
      price: null
    });
  });
});

async function registerAndGetAccessToken(app: INestApplication, email: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/auth/register")
    .set("x-forwarded-for", email)
    .send({ email, password: "strong-password" })
    .expect(201);

  return response.body.accessToken;
}

async function createBusiness(app: INestApplication, accessToken: string, name: string) {
  const response = await request(app.getHttpServer())
    .post("/businesses")
    .set("authorization", `Bearer ${accessToken}`)
    .send({ businessType: "BARBER", name, timezone: "Asia/Amman" })
    .expect(201);

  return response.body;
}

async function createService(
  app: INestApplication,
  accessToken: string,
  businessId: string,
  body: { description: string; durationMinutes: number; name: string; price?: number }
) {
  const response = await request(app.getHttpServer())
    .post(`/businesses/${businessId}/services`)
    .set("authorization", `Bearer ${accessToken}`)
    .send(body)
    .expect(201);

  return response.body;
}
