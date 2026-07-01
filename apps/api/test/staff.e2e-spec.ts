import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AUTH_REPOSITORY } from "../src/auth/auth.repository";
import { PostgresAuthRepository } from "../src/auth/postgres-auth.repository";
import { BUSINESS_REPOSITORY } from "../src/businesses/business.repository";
import { PostgresBusinessRepository } from "../src/businesses/postgres-business.repository";
import { PostgresStaffRepository } from "../src/staff/postgres-staff.repository";
import { STAFF_REPOSITORY } from "../src/staff/staff.repository";
import { InMemoryAuthRepository } from "./in-memory-auth.repository";
import { InMemoryBusinessRepository } from "./in-memory-business.repository";
import { InMemoryStaffRepository } from "./in-memory-staff.repository";

describe("StaffController", () => {
  let app: INestApplication;
  let staffRepository: InMemoryStaffRepository;

  beforeEach(async () => {
    staffRepository = new InMemoryStaffRepository();

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
      .overrideProvider(STAFF_REPOSITORY)
      .useValue(staffRepository)
      .overrideProvider(PostgresStaffRepository)
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

  it("creates, lists, views, updates, and deactivates staff for a business member", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const business = await createBusiness(app, owner.accessToken, "Owner Business");
    const staffMember = await createStaffMember(app, owner.accessToken, business.id, {
      displayName: "Staff Member",
      userId: staffUser.userId
    });

    expect(staffMember).toMatchObject({
      active: true,
      businessId: business.id,
      displayName: "Staff Member",
      userId: staffUser.userId
    });

    const listResponse = await request(app.getHttpServer())
      .get(`/businesses/${business.id}/staff`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].id).toBe(staffMember.id);

    await request(app.getHttpServer())
      .get(`/businesses/${business.id}/staff/${staffMember.id}`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/businesses/${business.id}/staff/${staffMember.id}`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ displayName: "Updated Staff" })
      .expect(200);

    expect(updateResponse.body.displayName).toBe("Updated Staff");

    const deactivateResponse = await request(app.getHttpServer())
      .post(`/businesses/${business.id}/staff/${staffMember.id}/deactivate`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    expect(deactivateResponse.body.active).toBe(false);
    expect(staffRepository.getStaffMembers()).toHaveLength(1);
  });

  it("prevents users without business access from accessing or modifying staff", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const other = await registerAndGetIdentity(app, "other@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const business = await createBusiness(app, owner.accessToken, "Owner Business");
    const staffMember = await createStaffMember(app, owner.accessToken, business.id, {
      displayName: "Staff Member",
      userId: staffUser.userId
    });

    await request(app.getHttpServer())
      .get(`/businesses/${business.id}/staff`)
      .set("authorization", `Bearer ${other.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/businesses/${business.id}/staff/${staffMember.id}`)
      .set("authorization", `Bearer ${other.accessToken}`)
      .send({ displayName: "Unauthorized" })
      .expect(404);
  });

  it("keeps staff scoped to their owning business", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const firstBusiness = await createBusiness(app, owner.accessToken, "First Business");
    const secondBusiness = await createBusiness(app, owner.accessToken, "Second Business");
    const staffMember = await createStaffMember(app, owner.accessToken, firstBusiness.id, {
      displayName: "First Staff",
      userId: staffUser.userId
    });

    await request(app.getHttpServer())
      .get(`/businesses/${secondBusiness.id}/staff/${staffMember.id}`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(404);
  });

  it("rejects invalid staff input and unauthenticated creation", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const business = await createBusiness(app, owner.accessToken, "Owner Business");

    await request(app.getHttpServer())
      .post(`/businesses/${business.id}/staff`)
      .send({ displayName: "No Auth", userId: owner.userId })
      .expect(401);

    await request(app.getHttpServer())
      .post(`/businesses/${business.id}/staff`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ displayName: "", userId: "not-a-uuid" })
      .expect(400);
  });
});

async function registerAndGetIdentity(app: INestApplication, email: string): Promise<{ accessToken: string; userId: string }> {
  const response = await request(app.getHttpServer())
    .post("/auth/register")
    .set("x-forwarded-for", email)
    .send({ email, password: "strong-password" })
    .expect(201);

  return {
    accessToken: response.body.accessToken,
    userId: getSubjectFromJwt(response.body.accessToken)
  };
}

async function createBusiness(app: INestApplication, accessToken: string, name: string) {
  const response = await request(app.getHttpServer())
    .post("/businesses")
    .set("authorization", `Bearer ${accessToken}`)
    .send({ businessType: "BARBER", name, timezone: "Asia/Amman" })
    .expect(201);

  return response.body;
}

async function createStaffMember(
  app: INestApplication,
  accessToken: string,
  businessId: string,
  body: { displayName: string; userId: string }
) {
  const response = await request(app.getHttpServer())
    .post(`/businesses/${businessId}/staff`)
    .set("authorization", `Bearer ${accessToken}`)
    .send(body)
    .expect(201);

  return response.body;
}

function getSubjectFromJwt(accessToken: string): string {
  const payload = accessToken.split(".")[1];
  const decodedPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return decodedPayload.sub;
}
