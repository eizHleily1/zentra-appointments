export function buildBookAppointmentPayload(input: {
  clientId: string;
  serviceId: string;
  staffMemberId: string;
  startTime: string;
}): {
  clientId: string;
  serviceId: string;
  staffMemberId: string;
  startTime: string;
} {
  return {
    clientId: input.clientId,
    serviceId: input.serviceId,
    staffMemberId: input.staffMemberId,
    startTime: input.startTime
  };
}
