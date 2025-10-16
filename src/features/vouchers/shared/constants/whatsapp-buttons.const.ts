import { ButtonOption } from '../../infrastructure/whatsapp/whatsapp-messaging.service';

/**
 * Plantillas de botones reutilizables para WhatsApp
 * Centraliza los botones utilizados en múltiples use cases
 */

/**
 * Botones de confirmación: "Sí, es correcto" y "No, editar datos"
 * Se utiliza cuando el usuario necesita confirmar los datos del voucher
 */
export const CONFIRM_CANCEL_BUTTONS: ButtonOption[] = [
  {
    id: 'confirm',
    title: '✅ Sí, es correcto',
  },
  {
    id: 'cancel',
    title: '❌ No. Editar datos ✏️',
  },
];

/**
 * Botones simples de sí/no
 * Se utiliza cuando se necesita una respuesta binaria genérica
 */
export const YES_NO_BUTTONS: ButtonOption[] = [
  {
    id: 'yes',
    title: '✅ Sí',
  },
  {
    id: 'no',
    title: '❌ No',
  },
];

/**
 * Botones para corregir datos
 * Se utiliza cuando se ofrece al usuario la opción de corregir o confirmar
 */
export const CONFIRM_EDIT_BUTTONS: ButtonOption[] = [
  {
    id: 'confirm',
    title: '✅ Confirmar',
  },
  {
    id: 'edit',
    title: '✏️ Editar',
  },
];
