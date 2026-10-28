import type { AppointmentInput, AppointmentSlotsResponse, ChatResponse } from '../../shared/api/chat'
import { APPOINTMENT_DAYS_AHEAD, appointmentLabel, isOfferedSlot } from '../../shared/config/appointments'
import { ChatDataError, type ChatData } from '../data/chat-data'

const DAY_MS = 86_400_000

/** Horas ya tomadas en los días que se ofrecen. */
export async function appointmentSlots(chat: ChatData, now: Date): Promise<AppointmentSlotsResponse> {
  const to = new Date(now.getTime() + (APPOINTMENT_DAYS_AHEAD + 1) * DAY_MS)
  return { taken: await chat.takenAppointmentSlots(now.toISOString(), to.toISOString()) }
}

/**
 * Agenda la cita y deja constancia en la conversación (el cliente la ve en su chat y la administración, en Conversaciones).
 * La cita misma llega a Brigitte en el panel (módulo Citas).
 */
export async function bookAppointment(chat: ChatData, ref: string, input: Pick<AppointmentInput, 'name' | 'phone' | 'startsAt'>, now = new Date()): Promise<ChatResponse> {
  const startsAt = new Date(input.startsAt)
  const { taken } = await appointmentSlots(chat, now)
  if (!isOfferedSlot(startsAt, now, taken)) {
    throw new ChatDataError('invalid_request', 'Esa hora ya no está disponible. Elige otra, por favor.')
  }
  const when = appointmentLabel(startsAt)
  const name = input.name.trim()
  const asked = await chat.record({
    channel: 'web_chat',
    ref,
    role: 'customer',
    body: `📅 Quiero agendar una cita el ${when}.\nNombre: ${name}\nCelular: ${input.phone}`,
    contactName: name,
    contactPhone: input.phone,
  })
  await chat.bookAppointment({ ref, name, phone: input.phone, startsAt: startsAt.toISOString() })
  const reply = await chat.record({
    channel: 'web_chat',
    ref,
    role: 'assistant',
    body: `Listo, ${name.split(/\s+/)[0]}: tu cita quedó agendada para el ${when}. La administración se comunicará contigo al ${input.phone} en ese horario.`,
  })
  const found = await chat.messagesAfter('web_chat', ref, asked.messageId - 1)
  return found ?? { status: reply.status, messages: [] }
}
