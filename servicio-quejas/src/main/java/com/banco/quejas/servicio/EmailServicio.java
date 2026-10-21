package com.banco.quejas.servicio;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.core.io.ByteArrayResource;
import jakarta.mail.internet.MimeMessage;

@Service
public class EmailServicio {

    @Autowired
    private JavaMailSender mailSender;

    public void enviarCorreoRegistroQueja(String destinatario, String numeroTicket, String titulo) {
        try {
            SimpleMailMessage mensaje = new SimpleMailMessage();

            // Configuración del correo
            mensaje.setFrom("bncnotify@outlook.com");
            mensaje.setTo(destinatario);
            mensaje.setSubject("¡Queja Registrada con Éxito! - Ticket: " + numeroTicket);

            mensaje.setText("Estimado cliente,\n\n" +
                    "Le informamos que su queja titulada \"" + titulo
                    + "\" ha sido registrada exitosamente en nuestro sistema.\n\n" +
                    "Su número de ticket asignado es: " + numeroTicket + "\n\n" +
                    "Puede utilizar este número para dar seguimiento al estado de su trámite.\n\n" +
                    "Atentamente,\n" +
                    "Banco Capital Nacional, S.A. (BCN)");

            // Enviar el correo
            mailSender.send(mensaje);
            System.out.println("Correo enviado exitosamente a: " + destinatario);

        } catch (Exception e) {
            System.err.println("Error al enviar el correo: " + e.getMessage());
            e.printStackTrace();
        }
    }

    // Método para notificar al agente sobre una nueva asignación
    public void enviarCorreoAsignacionAgente(String correoAgente, String numeroTicket, String titulo) {
        try {
            SimpleMailMessage mensaje = new SimpleMailMessage();

            mensaje.setFrom("bncnotify@outlook.com"); // Debe coincidir con tu username de properties
            mensaje.setTo(correoAgente);
            mensaje.setSubject("Atención: Nueva Queja Asignada - Ticket " + numeroTicket);

            mensaje.setText("Estimado Agente,\n\n" +
                    "El sistema del Banco Capital Nacional le ha asignado una nueva queja para su gestión.\n\n" +
                    "Detalles de la asignación:\n" +
                    "- Número de Ticket: " + numeroTicket + "\n" +
                    "- Título: " + titulo + "\n\n" +
                    "Por favor, ingrese al portal administrativo del Banco Capital Nacional para verificar los documentos adjuntos y darle solucion al ticket.\n\n"
                    +
                    "Atentamente,\n" +
                    "Sistema Automático de Quejas - BCN");

            mailSender.send(mensaje);
            System.out.println("Correo de asignación enviado exitosamente al agente: " + correoAgente);

        } catch (Exception e) {
            System.err.println("Error al enviar el correo al agente: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public void enviarCorreoSolicitudInformacion(String destinatario, String numeroTicket, String justificacion) {
        try {
            org.springframework.mail.SimpleMailMessage mensaje = new org.springframework.mail.SimpleMailMessage();
            mensaje.setFrom("bncnotify@outlook.com");
            mensaje.setTo(destinatario);
            mensaje.setSubject("Información Adicional Requerida - Ticket: " + numeroTicket);
            mensaje.setText("Estimado cliente,\n\n"
                    + "Para continuar con el análisis de su queja con ticket " + numeroTicket + ", "
                    + "necesitamos que nos proporcione la siguiente información o documentación adicional:\n\n"
                    + "\"" + justificacion + "\"\n\n"
                    + "Por favor, ingrese al portal de quejas para adjuntar lo solicitado.\n\n"
                    + "Atentamente,\n"
                    + "Banco Capital Nacional, S.A. (BCN)");

            mailSender.send(mensaje);
            System.out.println("Correo enviado exitosamente a: " + destinatario);
        } catch (Exception e) {
            System.err.println("Error al enviar correo de solicitud de información: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public void enviarCorreoRespuestaCliente(String destinatario, String numeroTicket, String mensaje) {
        try {
            org.springframework.mail.SimpleMailMessage mensajen = new org.springframework.mail.SimpleMailMessage();
            mensajen.setFrom("bncnotify@outlook.com");
            mensajen.setTo(destinatario);
            mensajen.setSubject("Respuesta del Cliente - Ticket: " + numeroTicket);
            mensajen.setText("Estimado Agente,\n\n"
                    + "Para continuar con el análisis de la queja con ticket " + numeroTicket + ", "
                    + "el cliente brindo la siguiente información:\n\n"
                    + "\"" + mensaje + "\"\n\n"
                    + "Por favor, ingrese al portal de quejas para continuar con el proceso de resolución.\n\n"
                    + "Atentamente,\n"
                    + "Banco Capital Nacional, S.A. (BCN)");

            mailSender.send(mensajen);
            System.out.println("Correo enviado exitosamente a: " + destinatario);
        } catch (Exception e) {
            System.err.println("Error al enviar correo de solicitud de información: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public void enviarCorreoResolucionFinalConPdf(String destinatario, String numeroTicket, byte[] pdfAdjunto) {
        try {
            // Se utiliza MimeMessage para soportar correos con archivos adjuntos (multipart)
            MimeMessage mensaje = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mensaje, true, "UTF-8");

            // Configuración del correo
            helper.setFrom("bncnotify@outlook.com");
            helper.setTo(destinatario);
            helper.setSubject("Resolución Final de Queja - Ticket: " + numeroTicket);

            helper.setText("Estimado cliente,\n\n" +
                    "Le informamos que el proceso de auditoría y revisión de su queja ha concluido.\n\n" +
                    "Adjunto a este correo encontrará el dictamen oficial con la resolución final.\n\n " +
                    "Atentamente,\n" +
                    "Banco Capital Nacional, S.A. (BCN)");

            // Adjuntar el PDF convirtiendo el arreglo de bytes
            helper.addAttachment("Resolucion_" + numeroTicket + ".pdf", new ByteArrayResource(pdfAdjunto));

            // Enviar el correo
            mailSender.send(mensaje);
            System.out.println("Correo con PDF enviado exitosamente a: " + destinatario);

        } catch (Exception e) {
            System.err.println("Error al enviar el correo con PDF: " + e.getMessage());
            e.printStackTrace();
        }
    }

}