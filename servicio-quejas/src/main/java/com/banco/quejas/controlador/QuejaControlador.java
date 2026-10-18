package com.banco.quejas.controlador;

import com.banco.quejas.modelo.Documento;
import com.banco.quejas.modelo.EstadoQueja;
import com.banco.quejas.modelo.MensajeQueja;
import com.banco.quejas.repositorio.QuejaRepositorio;
import com.banco.quejas.modelo.Producto;
import com.banco.quejas.modelo.Queja;
import com.banco.quejas.repositorio.DocumentoRepositorio;
import com.banco.quejas.repositorio.EstadoQuejaRepositorio;
import com.banco.quejas.repositorio.ProductoRepositorio;
import com.banco.quejas.repositorio.BitacoraQuejaRepositorio;
import com.banco.quejas.repositorio.MensajeQuejaRepositorio;
import com.banco.quejas.repositorio.QuejaRepositorio;
import com.banco.quejas.servicio.QuejaServicio;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.banco.quejas.servicio.DocuSignService;
import com.banco.quejas.servicio.EmailServicio;
import com.banco.quejas.servicio.PdfServicio;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/quejas")
public class QuejaControlador {

    @Autowired
    private QuejaServicio quejaServicio;

    @Autowired
    private DocumentoRepositorio documentoRepositorio;

    @Autowired
    private ProductoRepositorio productoRepositorio;

    @Autowired
    private EstadoQuejaRepositorio estadoQuejaRepositorio;

    @Autowired
    private EmailServicio emailServicio;

    @Autowired
    private QuejaRepositorio quejaRepositorio;

    @Autowired
    private BitacoraQuejaRepositorio bitacoraQuejaRepositorio;

    @Autowired
    private MensajeQuejaRepositorio mensajeQuejaRepositorio;

    @Autowired
    private PdfServicio pdfServicio;

    @Autowired
    private DocuSignService docuSignService;

    private final String UPLOAD_DIR = "uploads/";

    @PostMapping
    public ResponseEntity crearQueja(
            @RequestParam("titulo") String titulo,
            @RequestParam("descripcion") String descripcion,
            @RequestParam("productoId") Long productoId,
            @RequestParam(value = "usuarioNombre", defaultValue = "") String usuarioNombre,
            @RequestParam(value = "usuarioApellido", defaultValue = "") String usuarioApellido,
            @RequestParam(value = "archivo", required = false) MultipartFile archivo,
            @RequestParam(value = "ticketPadre", required = false) String ticketPadre,
            @RequestHeader("Authorization") String authHeader,
            jakarta.servlet.http.HttpServletRequest request) {

        try {
            String emailUsuario = extraerEmailDelToken(authHeader);

            // RN07: Validaciones de archivo (PDF/JPEG y máximo 2MB)[cite: 2]
            if (archivo != null && !archivo.isEmpty()) {
                String tipo = archivo.getContentType();
                if (tipo == null || (!tipo.equals("application/pdf") && !tipo.equals("image/jpeg"))) {
                    return ResponseEntity.badRequest().body("Error: El documento debe ser en formato PDF o JPEG.");
                }
                if (archivo.getSize() > 2097152) { // 2MB en bytes
                    return ResponseEntity.badRequest()
                            .body("Error: El documento no debe superar el tamaño máximo de 2 MB.");
                }
            }

            // RN05: Validar y asignar el producto[cite: 2]
            Producto producto = productoRepositorio.findById(productoId)
                    .orElseThrow(() -> new Exception("El producto seleccionado no es válido."));

            // RN04: El estado inicial obligatorio es "Registrada"[cite: 2]
            EstadoQueja estadoInicial = estadoQuejaRepositorio.findByNombre("Registrada");
            if (estadoInicial == null) {
                throw new Exception("Error interno: Catálogo de estados no inicializado.");
            }

            Queja nuevaQueja = new Queja();
            nuevaQueja.setTitulo(titulo);
            nuevaQueja.setDescripcion(descripcion);
            nuevaQueja.setProducto(producto);
            nuevaQueja.setEstado(estadoInicial);
            nuevaQueja.setUsuarioNombre(usuarioNombre);
            nuevaQueja.setUsuarioApellido(usuarioApellido);

            if (ticketPadre != null && !ticketPadre.trim().isEmpty()) {

                Queja padre = quejaServicio.obtenerQuejaPorTicket(ticketPadre.trim());

                if (padre == null) {
                    return ResponseEntity.badRequest()
                            .body("Error: El número de ticket relacionado no existe.");
                }

                nuevaQueja.setQuejaPadre(padre);
            }

            String ipCliente = obtenerIpCliente(request);
            Queja quejaGuardada = quejaServicio.crearQueja(nuevaQueja, emailUsuario, ipCliente);

            // RN07: Guardar el documento físico y sus metadatos[cite: 2]
            if (archivo != null && !archivo.isEmpty()) {
                File directorio = new File(UPLOAD_DIR);
                if (!directorio.exists())
                    directorio.mkdirs();

                String nombreOriginal = archivo.getOriginalFilename();
                String extension = nombreOriginal.substring(nombreOriginal.lastIndexOf("."));
                String nombreUnico = UUID.randomUUID().toString() + extension;

                Path rutaCompleta = Paths.get(UPLOAD_DIR + nombreUnico);
                Files.copy(archivo.getInputStream(), rutaCompleta);

                // Conservar metadatos en la base de datos[cite: 2]
                Documento doc = new Documento();
                doc.setQueja(quejaGuardada);
                doc.setNombreOriginal(nombreOriginal);
                doc.setTipoArchivo(archivo.getContentType());
                doc.setTamano(archivo.getSize());
                doc.setRutaFisica(rutaCompleta.toString());
                doc.setUsuarioCarga(emailUsuario);

                documentoRepositorio.save(doc);
            }

            // NUEVO: Enviar correos electrónicos de notificación
            try {
                // 1. Notificar al cliente (Usuario Final)
                emailServicio.enviarCorreoRegistroQueja(
                        emailUsuario,
                        quejaGuardada.getNumeroTicket(),
                        quejaGuardada.getTitulo());

                // 2. Notificar al Agente Bancario (Si el balanceador asignó uno)
                if (quejaGuardada.getAgenteAsignadoEmail() != null) {
                    emailServicio.enviarCorreoAsignacionAgente(
                            quejaGuardada.getAgenteAsignadoEmail(),
                            quejaGuardada.getNumeroTicket(),
                            quejaGuardada.getTitulo());
                }

            } catch (Exception correoEx) {
                System.err.println("Advertencia: No se pudieron enviar los correos, pero la queja fue guardada: "
                        + correoEx.getMessage());
            }

            return ResponseEntity.ok(quejaGuardada);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error al registrar la queja: " + e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity listarQuejas(@RequestHeader("Authorization") String authHeader) {
        try {
            String emailUsuario = extraerEmailDelToken(authHeader);
            List quejas = quejaServicio.obtenerQuejasPorUsuario(emailUsuario);
            return ResponseEntity.ok(quejas);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error al obtener las quejas");
        }
    }

    // Endpoint para ver el detalle de una queja específica y sus documentos
    @GetMapping("/{numeroTicket}")
    public ResponseEntity<?> obtenerDetalleQueja(
            @PathVariable String numeroTicket,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String emailUsuario = extraerEmailDelToken(authHeader);

            Queja queja = quejaServicio.obtenerQuejaPorTicket(numeroTicket);

            // 1. Validar que la queja exista
            if (queja == null) {
                return ResponseEntity.status(404).body("La queja no existe.");
            }

            // 2. REGLA DE NEGOCIO: ¿Es el creador de la queja o el agente asignado?
            boolean esElCreador = queja.getUsuarioEmail().equals(emailUsuario);
            boolean esElAgenteAsignado = queja.getAgenteAsignadoEmail() != null &&
                    queja.getAgenteAsignadoEmail().equals(emailUsuario);

            String tokenPayload = new String(
                    java.util.Base64.getUrlDecoder().decode(authHeader.replace("Bearer ", "").split("\\.")[1]));
            boolean esSupervisor = tokenPayload.toUpperCase().contains("SUPERVISOR");
            boolean esJefe = tokenPayload.toUpperCase().contains("JEFE");

            // Si no es ninguno de los dos, se bloquea el acceso
            if (!esElCreador && !esElAgenteAsignado && !esSupervisor && !esJefe) {
                return ResponseEntity.status(403).body("Acceso denegado o la queja no existe.");
            }

            // Buscar los documentos asociados a esta queja
            List<Documento> documentos = documentoRepositorio.findByQuejaId(queja.getId());

            // Buscar si esta queja tiene otras quejas derivadas de ella
            List<Queja> quejasDerivadas = quejaRepositorio.findByQuejaPadreId(queja.getId());

            // Empaquetar la queja y los documentos juntos
            java.util.Map<String, Object> respuesta = new java.util.HashMap<>();
            respuesta.put("queja", queja);
            respuesta.put("documentos", documentos);
            respuesta.put("quejasRelacionadas", quejasDerivadas);

            return ResponseEntity.ok(respuesta);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error al obtener el detalle de la queja");
        }
    }

    // 4. Endpoint para visualizar o descargar un documento físico
    @GetMapping("/documento/{documentoId}")
    public ResponseEntity verDocumento(
            @PathVariable("documentoId") Long documentoId,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String emailUsuario = extraerEmailDelToken(authHeader);

            // 1. Buscar el documento en la base de datos
            Documento documento = documentoRepositorio.findById(documentoId)
                    .orElseThrow(() -> new Exception("Documento no encontrado"));

            boolean esElCreador = documento.getQueja().getUsuarioEmail().equals(emailUsuario);
            boolean esElAgenteAsignado = documento.getQueja().getAgenteAsignadoEmail() != null &&
                    documento.getQueja().getAgenteAsignadoEmail().equals(emailUsuario);

            String tokenPayload = new String(
                    java.util.Base64.getUrlDecoder().decode(authHeader.replace("Bearer ", "").split("\\.")[1]));
            boolean esSupervisor = tokenPayload.toUpperCase().contains("SUPERVISOR");
            boolean esJefe = tokenPayload.toUpperCase().contains("JEFE");

            // Si no es ninguno de los dos, bloqueamos el acceso
            if (!esElCreador && !esElAgenteAsignado && !esSupervisor && !esJefe) {
                return ResponseEntity.status(403).build(); // Acceso denegado
            }

            // 3. Cargar el archivo físico desde el disco duro
            Path rutaArchivo = Paths.get(documento.getRutaFisica());
            Resource recurso = new UrlResource(rutaArchivo.toUri());

            if (!recurso.exists() || !recurso.isReadable()) {
                throw new Exception("No se puede leer el archivo físico o no existe.");
            }

            // 4. Determinar el Content-Type dinámicamente (PDF o JPEG)
            MediaType mediaType = MediaType.parseMediaType(documento.getTipoArchivo());

            // 5. Enviar el archivo. "inline" le dice al navegador que intente mostrarlo (no
            // descargarlo a la fuerza)
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "inline; filename=\"" + documento.getNombreOriginal() + "\"")
                    .body(recurso);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    // 5. Endpoint para la Bandeja del Agente Bancario
    @GetMapping("/mis-asignadas")
    public ResponseEntity<List<Queja>> obtenerQuejasAsignadasAlAgente(
            @RequestHeader("Authorization") String authHeader) {
        try {
            // Extraemos el correo del agente usando el método que ya tienes programado
            String emailAgente = extraerEmailDelToken(authHeader);

            // Buscamos solo las quejas que tienen su correo
            List<Queja> quejasDelAgente = quejaRepositorio.findByAgenteAsignadoEmail(emailAgente);

            return ResponseEntity.ok(quejasDelAgente);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    private String extraerEmailDelToken(String authHeader) throws Exception {
        String token = authHeader.replace("Bearer ", "");
        String[] chunks = token.split("\\.");
        Base64.Decoder decoder = Base64.getUrlDecoder();
        String payload = new String(decoder.decode(chunks[1]));
        ObjectMapper mapper = new ObjectMapper();
        JsonNode payloadJson = mapper.readTree(payload);
        return payloadJson.get("sub").asText();
    }

    // ==========================================
    // CU04: BOTÓN "CONFIRMAR Y ENVIAR AL SUPERVISOR"
    // ==========================================
    @PutMapping("/{numeroTicket}/enviar-supervisor")
    public ResponseEntity<?> enviarASupervisor(
            @PathVariable String numeroTicket,
            @RequestBody java.util.Map<String, String> payload,
            @RequestHeader("Authorization") String authHeader,
            jakarta.servlet.http.HttpServletRequest request) {
        try {
            String emailAgente = extraerEmailDelToken(authHeader);
            String resolucion = payload.get("resolucion");

            // FA08: Validar campo vacío
            if (resolucion == null || resolucion.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Completa este campo.");
            }

            Queja queja = quejaServicio.obtenerQuejaPorTicket(numeroTicket);
            if (queja == null)
                return ResponseEntity.notFound().build();

            String estadoAnterior = queja.getEstado().getNombre();

            // Buscar nuevo estado (Asegúrate de que el nombre coincida exactamente con
            // tu BD)
            EstadoQueja estadoNuevo = estadoQuejaRepositorio.findByNombre("EnRevisionSupervisor");
            if (estadoNuevo == null)
                throw new Exception("El estado no existe en el catálogo.");

            // 1. Obtener datos exactos del agente desde la BD
            com.banco.quejas.repositorio.QuejaRepositorio.UsuarioProyeccion agenteInfo = quejaRepositorio
                    .buscarDatosUsuarioPorEmail(emailAgente);
            String nombreExactoAgente = agenteInfo != null ? (agenteInfo.getNombre() + " " + agenteInfo.getApellido())
                    : "Agente Bancario";
            String idExactoAgente = agenteInfo != null ? agenteInfo.getId() : emailAgente;

            // 2. Generar el PDF físicamente con los datos de la queja y la resolución
            byte[] resolucionPdf = pdfServicio.generarResolucionPdf(queja, resolucion, nombreExactoAgente, "", "", "");

            // 3. Obtener la URL segura de DocuSign
            java.util.Map<String, String> docuSignRespuesta = docuSignService.generarUrlDeFirma(
                    idExactoAgente,
                    nombreExactoAgente,
                    emailAgente,
                    resolucionPdf,
                    queja.getNumeroTicket(),
                    "/bandeja-agente");

            String urlFirma = docuSignRespuesta.get("url");
            String envelopeIdGuardar = docuSignRespuesta.get("envelopeId");

            queja.setEstado(estadoNuevo);
            queja.setResolucionAgente(resolucion);
            queja.setFirmaId(envelopeIdGuardar);
            quejaRepositorio.save(queja); // Guardamos los cambios

            // Guardar en la bitácora
            String ipCliente = obtenerIpCliente(request);
            com.banco.quejas.modelo.BitacoraQueja bitacora = new com.banco.quejas.modelo.BitacoraQueja(
                    emailAgente, queja.getId(), estadoAnterior, estadoNuevo.getNombre(),
                    "Traslado a Supervisor. Resolución redactada: " + resolucion, java.time.LocalDateTime.now(),
                    ipCliente);
            bitacoraQuejaRepositorio.save(bitacora);

            // ---> LO NUEVO: Mensaje automático para el cliente <---
            MensajeQueja mensajeAvance = new MensajeQueja(
                    queja,
                    emailAgente,
                    "AGENTE", // Usamos AGENTE para que el frontend lo pinte con el mismo estilo
                    "Se valida la información y está correcta, la queja avanza a la siguiente fase.",
                    java.time.LocalDateTime.now());
            mensajeQuejaRepositorio.save(mensajeAvance);
            // ---------------------------------------------------------

            return ResponseEntity.ok(java.util.Map.of(
                    "mensaje", "Resolución guardada. Redirigiendo a firma segura...",
                    "urlFirma", urlFirma));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Error al trasladar la queja o generar firma: " + e.getMessage());
        }
    }

    // ==========================================
    // CU04: BOTÓN "SOLICITAR INFORMACIÓN ADICIONAL" (FA03)
    // ==========================================
    @PutMapping("/{numeroTicket}/solicitar-info")
    public ResponseEntity<?> solicitarInformacion(
            @PathVariable String numeroTicket,
            @RequestBody java.util.Map<String, String> payload,
            @RequestHeader("Authorization") String authHeader,
            jakarta.servlet.http.HttpServletRequest request) {
        try {
            String emailAgente = extraerEmailDelToken(authHeader);
            String justificacion = payload.get("justificacion");

            // FA08: Validar campo vacío
            if (justificacion == null || justificacion.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Completa este campo.");
            }

            Queja queja = quejaServicio.obtenerQuejaPorTicket(numeroTicket);
            if (queja == null)
                return ResponseEntity.notFound().build();

            String estadoAnterior = queja.getEstado().getNombre();

            EstadoQueja estadoNuevo = estadoQuejaRepositorio.findByNombre("EsperandoDocumentacion");
            if (estadoNuevo == null)
                throw new Exception("El estado no existe en el catálogo.");

            queja.setEstado(estadoNuevo);
            queja.setResolucionAgente("Info solicitada: " + justificacion);
            quejaRepositorio.save(queja);

            // Guardamos la petición del agente como el primer mensaje del historial
            MensajeQueja mensajeAgente = new MensajeQueja(
                    queja, emailAgente, "AGENTE", justificacion, java.time.LocalDateTime.now());
            mensajeQuejaRepositorio.save(mensajeAgente);

            // Guardar en la bitácora
            String ipCliente = obtenerIpCliente(request);
            com.banco.quejas.modelo.BitacoraQueja bitacora = new com.banco.quejas.modelo.BitacoraQueja(
                    emailAgente, queja.getId(), estadoAnterior, estadoNuevo.getNombre(),
                    "Solicitud de información adicional. Motivo: " + justificacion, java.time.LocalDateTime.now(),
                    ipCliente);
            bitacoraQuejaRepositorio.save(bitacora);

            // Notificar al cliente
            emailServicio.enviarCorreoSolicitudInformacion(queja.getUsuarioEmail(), queja.getNumeroTicket(),
                    justificacion);

            return ResponseEntity.ok(java.util.Map.of("mensaje",
                    "La solicitud de información adicional ha sido enviada correctamente."));

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error interno: " + e.getMessage());
        }
    }

    // ==========================================
    // NUEVO: RESPUESTA DEL CLIENTE CON MÁS INFORMACIÓN
    // ==========================================
    @PostMapping("/{numeroTicket}/responder")
    public ResponseEntity<?> responderSolicitud(
            @PathVariable String numeroTicket,
            @RequestParam("mensaje") String mensaje,
            @RequestParam(value = "archivo", required = false) org.springframework.web.multipart.MultipartFile archivo,
            @RequestHeader("Authorization") String authHeader,
            jakarta.servlet.http.HttpServletRequest request) {

        if (archivo != null && !archivo.isEmpty()) {
            String tipo = archivo.getContentType();
            if (tipo == null || (!tipo.equals("application/pdf") && !tipo.equals("image/jpeg"))) {
                return ResponseEntity.badRequest().body("Error: El documento debe ser en formato PDF o JPEG.");
            }
            if (archivo.getSize() > 2097152) { // 2MB en bytes
                return ResponseEntity.badRequest()
                        .body("Error: El documento no debe superar el tamaño máximo de 2 MB.");
            }
        }

        try {
            String emailCliente = extraerEmailDelToken(authHeader);
            Queja queja = quejaServicio.obtenerQuejaPorTicket(numeroTicket);

            if (queja == null || !queja.getUsuarioEmail().equals(emailCliente)) {
                return ResponseEntity.status(403).body("Acceso denegado.");
            }

            String estadoAnterior = queja.getEstado().getNombre();

            // 1. Guardar el nuevo documento (si viene uno)
            if (archivo != null && !archivo.isEmpty()) {
                java.io.File directorio = new java.io.File(UPLOAD_DIR);
                if (!directorio.exists())
                    directorio.mkdirs();

                String nombreOriginal = archivo.getOriginalFilename();
                String extension = nombreOriginal.substring(nombreOriginal.lastIndexOf("."));
                String nombreUnico = java.util.UUID.randomUUID().toString() + extension;

                java.nio.file.Path rutaCompleta = java.nio.file.Paths.get(UPLOAD_DIR + nombreUnico);
                java.nio.file.Files.copy(archivo.getInputStream(), rutaCompleta);

                Documento doc = new Documento();
                doc.setQueja(queja);
                doc.setNombreOriginal(nombreOriginal);
                doc.setTipoArchivo(archivo.getContentType());
                doc.setTamano(archivo.getSize());
                doc.setRutaFisica(rutaCompleta.toString());
                doc.setUsuarioCarga(emailCliente);

                documentoRepositorio.save(doc);
            }

            // 2. Guardar el mensaje en el "Chat"
            // (Asegúrate de inyectar MensajeQuejaRepositorio arriba en tu controlador)
            MensajeQueja nuevoMensaje = new MensajeQueja(
                    queja, emailCliente, "CLIENTE", mensaje, java.time.LocalDateTime.now());
            mensajeQuejaRepositorio.save(nuevoMensaje);

            // 3. Regresar la queja a la bandeja del Agente
            EstadoQueja estadoValidacion = estadoQuejaRepositorio.findByNombre("EnValidacion");
            queja.setEstado(estadoValidacion);
            quejaRepositorio.save(queja);

            // 4. Registrar en Bitácora
            String ipCliente = obtenerIpCliente(request);
            com.banco.quejas.modelo.BitacoraQueja bitacora = new com.banco.quejas.modelo.BitacoraQueja(
                    emailCliente, queja.getId(), estadoAnterior, "EnValidacion",
                    "El cliente proporcionó información adicional y adjuntó nueva evidencia.",
                    java.time.LocalDateTime.now(), ipCliente);
            bitacoraQuejaRepositorio.save(bitacora);

            // Opcional: Notificar al agente asignado que el cliente ya respondió
            emailServicio.enviarCorreoRespuestaCliente(
                    queja.getAgenteAsignadoEmail(), queja.getNumeroTicket(),
                    "Respuesta de cliente recibida: " + mensaje);

            return ResponseEntity.ok(java.util.Map.of("mensaje",
                    "Información enviada correctamente."));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error al procesar la respuesta: " + e.getMessage());
        }
    }

    // ==========================================
    // NUEVO: OBTENER EL HISTORIAL DE MENSAJES (CHAT)
    // ==========================================
    @GetMapping("/{numeroTicket}/mensajes")
    public ResponseEntity<?> obtenerMensajesQueja(
            @PathVariable String numeroTicket,
            @RequestHeader("Authorization") String authHeader) {

        try {
            String emailUsuario = extraerEmailDelToken(authHeader);
            Queja queja = quejaServicio.obtenerQuejaPorTicket(numeroTicket);

            if (queja == null) {
                return ResponseEntity.status(404).body("La queja no existe.");
            }

            // Validar seguridad: Solo el cliente creador o el agente asignado pueden ver el
            // chat
            boolean esElCreador = queja.getUsuarioEmail().equals(emailUsuario);
            boolean esElAgenteAsignado = queja.getAgenteAsignadoEmail() != null &&
                    queja.getAgenteAsignadoEmail().equals(emailUsuario);

            if (!esElCreador && !esElAgenteAsignado) {
                return ResponseEntity.status(403).body("Acceso denegado al historial.");
            }

            // Llamamos a la base de datos para traer el historial ordenado
            List<MensajeQueja> historial = mensajeQuejaRepositorio.findByQuejaIdOrderByFechaHoraAsc(queja.getId());

            return ResponseEntity.ok(historial);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error al obtener el historial de mensajes");
        }
    }

    // =======================================================
    // CU05: 1. LISTAR QUEJAS DEL SUPERVISOR (FNB 1.3.4 y FA01)
    // =======================================================
    @GetMapping("/supervisor/pendientes")
    public ResponseEntity<?> obtenerQuejasParaSupervisor(@RequestHeader("Authorization") String authHeader) {
        try {
            // Buscamos ambos estados en la BD
            EstadoQueja estadoRevision = estadoQuejaRepositorio.findByNombre("EnRevisionSupervisor");
            EstadoQueja estadoDevuelta = estadoQuejaRepositorio.findByNombre("DevueltaParaRevision");

            java.util.List<Queja> quejasPendientes = new java.util.ArrayList<>();

            if (estadoRevision != null) {
                quejasPendientes.addAll(quejaRepositorio.findByEstado(estadoRevision));
            }
            if (estadoDevuelta != null) {
                quejasPendientes.addAll(quejaRepositorio.findByEstado(estadoDevuelta));
            }

            return ResponseEntity.ok(quejasPendientes);

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error al obtener las quejas del supervisor");
        }
    }

    // =======================================================
    // CU05: ESTADÍSTICAS DEL SUPERVISOR (FNB 1.3.1)
    // =======================================================
    @GetMapping("/supervisor/estadisticas")
    public ResponseEntity<?> obtenerEstadisticasSupervisor(@RequestHeader("Authorization") String authHeader) {
        try {
            // Buscamos cuántas quejas hay en revisión
            EstadoQueja estadoRevision = estadoQuejaRepositorio.findByNombre("EnRevisionSupervisor");
            long pendientes = (estadoRevision != null) ? quejaRepositorio.findByEstado(estadoRevision).size() : 0;

            // Puedes agregar más contadores en el futuro aquí
            return ResponseEntity.ok(java.util.Map.of(
                    "pendientesDeRevision", pendientes,
                    "mensajeBienvenida", "¡Bienvenido! Tienes " + pendientes + " quejas pendientes de revisión."));
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error al obtener estadísticas");
        }
    }

    // =======================================================
    // CU05: 2. BOTÓN "CONFIRMAR Y ENVIAR AL JEFE" (FNB 1.3.15)
    // =======================================================
    @PutMapping("/{numeroTicket}/enviar-jefe")
    public ResponseEntity<?> enviarAJefe(
            @PathVariable String numeroTicket,
            @RequestBody java.util.Map<String, String> payload,
            @RequestHeader("Authorization") String authHeader,
            jakarta.servlet.http.HttpServletRequest request) {
        try {
            String emailSupervisor = extraerEmailDelToken(authHeader);
            String observaciones = payload.get("observaciones");

            String nombreSupervisor = payload.getOrDefault("nombreFirmante", "Supervisor BCN");

            // FA05: Validar campo vacío
            if (observaciones == null || observaciones.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Debe ingresar un texto antes de enviar.");
            }

            Queja queja = quejaServicio.obtenerQuejaPorTicket(numeroTicket);
            if (queja == null)
                return ResponseEntity.notFound().build();

            String estadoAnterior = queja.getEstado().getNombre();

            EstadoQueja estadoNuevo = estadoQuejaRepositorio.findByNombre("EnRevisionJefe");
            if (estadoNuevo == null)
                throw new Exception("El estado 'EnRevisionJefe' no existe.");

            // 1. Descargamos el PDF que YA trae la firma del Agente
            byte[] pdfConFirmaAgente = docuSignService.descargarDocumentoFirmado(queja.getFirmaId());

            // 2. Generamos una nueva URL de firma, ahora para el Supervisor.
            // (Usamos el email extraído del token, y puedes ajustar el nombre si tienes
            // cómo extraerlo)
            java.util.Map<String, String> docuSignRespuesta = docuSignService.generarUrlDeFirma(
                    "sup-" + queja.getId(), // Un ID único referencial
                    nombreSupervisor, // Nombre a mostrar en la firma
                    emailSupervisor, // Correo real del supervisor
                    pdfConFirmaAgente, // El PDF que ya trae la primera firma
                    numeroTicket,
                    "/bandeja-supervisor" // La ruta de retorno de tu React
            );

            queja.setEstado(estadoNuevo);
            queja.setObservacionesSupervisor(observaciones);
            queja.setFirmaId(docuSignRespuesta.get("envelopeId"));
            quejaRepositorio.save(queja);

            // Registro de Bitácora
            String ipCliente = obtenerIpCliente(request);
            com.banco.quejas.modelo.BitacoraQueja bitacora = new com.banco.quejas.modelo.BitacoraQueja(
                    emailSupervisor, queja.getId(), estadoAnterior, estadoNuevo.getNombre(),
                    "Revisión Aprobada. Traslado a Jefe con observaciones: " + observaciones,
                    java.time.LocalDateTime.now(), ipCliente);
            bitacoraQuejaRepositorio.save(bitacora);

            // Mensaje automático de avance para el chat del Cliente
            MensajeQueja mensajeAvance = new MensajeQueja(
                    queja, emailSupervisor, "SUPERVISOR",
                    "La resolución ha sido validada y avanza a la siguiente etapa.",
                    java.time.LocalDateTime.now());
            mensajeQuejaRepositorio.save(mensajeAvance);

            return ResponseEntity.ok(java.util.Map.of(
                    "mensaje", "Preparando entorno seguro para firma...",
                    "urlFirma", docuSignRespuesta.get("url")));

        } catch (Exception e) {
            e.printStackTrace();
            // FA04: Error al trasladar la queja al Jefe
            return ResponseEntity.status(500).body("No fue posible trasladar la queja al Jefe: " + e.getMessage());
        }
    }

    // =======================================================
    // CU05: 3. BOTÓN "DEVOLVER AL AGENTE" (FA03)
    // =======================================================
    @PutMapping("/{numeroTicket}/devolver-agente")
    public ResponseEntity<?> devolverAAgente(
            @PathVariable String numeroTicket,
            @RequestBody java.util.Map<String, String> payload,
            @RequestHeader("Authorization") String authHeader,
            jakarta.servlet.http.HttpServletRequest request) {
        try {
            String emailSupervisor = extraerEmailDelToken(authHeader);
            String motivo = payload.get("observaciones"); // Reutilizamos el textarea de observaciones

            // FA05: Validar campo vacío
            if (motivo == null || motivo.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Debe ingresar un texto antes de enviar.");
            }

            Queja queja = quejaServicio.obtenerQuejaPorTicket(numeroTicket);
            if (queja == null)
                return ResponseEntity.notFound().build();

            String estadoAnterior = queja.getEstado().getNombre();

            EstadoQueja estadoNuevo = estadoQuejaRepositorio.findByNombre("DevueltaParaRevision");
            if (estadoNuevo == null)
                throw new Exception("El estado 'DevueltaParaRevision' no existe.");

            queja.setEstado(estadoNuevo);
            queja.setObservacionesSupervisor("Devuelta: " + motivo);
            quejaRepositorio.save(queja);

            MensajeQueja mensajeDevolucion = new MensajeQueja(
                    queja, emailSupervisor, "SUPERVISOR",
                    "Queja devuelta para correcciones obligatorias: " + motivo,
                    java.time.LocalDateTime.now());
            mensajeQuejaRepositorio.save(mensajeDevolucion);

            // Registro de Bitácora
            String ipCliente = obtenerIpCliente(request);
            com.banco.quejas.modelo.BitacoraQueja bitacora = new com.banco.quejas.modelo.BitacoraQueja(
                    emailSupervisor, queja.getId(), estadoAnterior, estadoNuevo.getNombre(),
                    "Devuelta al Agente. Motivo: " + motivo,
                    java.time.LocalDateTime.now(), ipCliente);
            bitacoraQuejaRepositorio.save(bitacora);

            // FA03: Notificar al Agente Bancario
            emailServicio.enviarCorreoAsignacionAgente(
                    queja.getAgenteAsignadoEmail(), queja.getNumeroTicket(),
                    "URGENTE: La queja ha sido devuelta por el Supervisor para correcciones. Motivo: " + motivo);

            return ResponseEntity
                    .ok(java.util.Map.of("mensaje", "La queja ha sido devuelta al Agente Bancario para su revisión."));

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error interno: " + e.getMessage());
        }
    }

    private String obtenerIpCliente(jakarta.servlet.http.HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }

    // ==========================================
    @GetMapping("/{numeroTicket}/descargar-resolucion")
    public ResponseEntity<byte[]> descargarResolucionFirmada(@PathVariable String numeroTicket) {
        try {
            Queja queja = quejaServicio.obtenerQuejaPorTicket(numeroTicket);
            if (queja == null || queja.getFirmaId() == null) {
                return ResponseEntity.notFound().build();
            }

            // Traemos el PDF fresco y firmado desde la nube de DocuSign
            byte[] pdfFirmado = docuSignService.descargarDocumentoFirmado(queja.getFirmaId());

            // Preparamos la respuesta para que el navegador sepa que es un PDF
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("inline", "Resolucion_" + numeroTicket + ".pdf");

            return new ResponseEntity<>(pdfFirmado, headers, org.springframework.http.HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    // =======================================================
    // CU06: 1. LISTAR QUEJAS DEL JEFE
    // =======================================================
    @GetMapping("/jefe/pendientes")
    public ResponseEntity<?> obtenerQuejasParaJefe(@RequestHeader("Authorization") String authHeader) {
        try {
            // Buscamos los dos estados que solicita la bandeja del Jefe
            EstadoQueja estadoRevision = estadoQuejaRepositorio.findByNombre("EnRevisionJefe");
            EstadoQueja estadoDevuelta = estadoQuejaRepositorio.findByNombre("DevueltaParaRevision");

            java.util.List<Queja> quejasPendientes = new java.util.ArrayList<>();

            if (estadoRevision != null) {
                quejasPendientes.addAll(quejaRepositorio.findByEstado(estadoRevision));
            }
            if (estadoDevuelta != null) {
                quejasPendientes.addAll(quejaRepositorio.findByEstado(estadoDevuelta));
            }

            return ResponseEntity.ok(quejasPendientes);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error al obtener las quejas de la jefatura.");
        }
    }

    // =======================================================
    // CU06: ESTADÍSTICAS DEL JEFE
    // =======================================================
    @GetMapping("/jefe/estadisticas")
    public ResponseEntity<?> obtenerEstadisticasJefe(@RequestHeader("Authorization") String authHeader) {
        try {
            EstadoQueja estadoRevision = estadoQuejaRepositorio.findByNombre("EnRevisionJefe");
            EstadoQueja estadoDevuelta = estadoQuejaRepositorio.findByNombre("DevueltaParaRevision");

            long pendientes = (estadoRevision != null) ? quejaRepositorio.findByEstado(estadoRevision).size() : 0;
            long devueltas = (estadoDevuelta != null) ? quejaRepositorio.findByEstado(estadoDevuelta).size() : 0;
            long total = pendientes + devueltas;

            return ResponseEntity.ok(java.util.Map.of(
                    "pendientesDeRevision", pendientes,
                    "devueltas", devueltas,
                    "mensajeBienvenida", "¡Bienvenido! Tienes " + total + " trámites en tu bandeja directiva."));
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error al obtener estadísticas de jefatura");
        }
    }

    // =======================================================
    // CU06: 2. BOTÓN "APROBAR Y FIRMAR" (DOCUSIGN)
    // =======================================================
    @PutMapping("/{numeroTicket}/enviar-gerente")
    public ResponseEntity<?> enviarAGerente(
            @PathVariable String numeroTicket,
            @RequestBody java.util.Map<String, String> payload,
            @RequestHeader("Authorization") String authHeader,
            jakarta.servlet.http.HttpServletRequest request) {
        try {
            String emailJefe = extraerEmailDelToken(authHeader);
            String observaciones = payload.get("observaciones");
            String nombreJefe = payload.getOrDefault("nombreFirmante", "Jefe Directivo");

            if (observaciones == null || observaciones.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Debe ingresar un texto antes de enviar.");
            }

            Queja queja = quejaServicio.obtenerQuejaPorTicket(numeroTicket);
            if (queja == null)
                return ResponseEntity.notFound().build();

            String estadoAnterior = queja.getEstado().getNombre();
            EstadoQueja estadoNuevo = estadoQuejaRepositorio.findByNombre("EnDictamen");
            if (estadoNuevo == null)
                throw new Exception("El estado 'EnDictamen' no existe.");

            // 1. Descargamos el PDF que YA trae las 2 firmas anteriores (Agente y
            // Supervisor)
            byte[] pdfConDosFirmas = docuSignService.descargarDocumentoFirmado(queja.getFirmaId());

            // 2. Generamos una nueva URL de firma, ahora para el Jefe, anclada a la palabra
            // "Jefe"
            java.util.Map<String, String> docuSignRespuesta = docuSignService.generarUrlDeFirma(
                    "jef-" + queja.getId(),
                    nombreJefe,
                    emailJefe,
                    pdfConDosFirmas,
                    numeroTicket,
                    "/bandeja-jefe"
            );

            queja.setEstado(estadoNuevo);
            queja.setFirmaId(docuSignRespuesta.get("envelopeId"));
            quejaRepositorio.save(queja);

            // Bitácora
            String ipCliente = obtenerIpCliente(request);
            com.banco.quejas.modelo.BitacoraQueja bitacora = new com.banco.quejas.modelo.BitacoraQueja(
                    emailJefe, queja.getId(), estadoAnterior, estadoNuevo.getNombre(),
                    "Revisión Aprobada. Traslado a Jefe con observaciones: " + observaciones,
                    java.time.LocalDateTime.now(), ipCliente);
            bitacoraQuejaRepositorio.save(bitacora);

            // Mensaje de chat para el cliente
            MensajeQueja mensajeAvance = new MensajeQueja(
                    queja, emailJefe, "JEFE",
                    "La resolución ha sido validada y avanza a la siguiente etapa.",
                    java.time.LocalDateTime.now());
            mensajeQuejaRepositorio.save(mensajeAvance);

            // Notificación por correo de cierre
            emailServicio.enviarCorreoAsignacionAgente(
                    queja.getUsuarioEmail(), queja.getNumeroTicket(),
                    "Su queja ha sido resuelta y aprobada por la dirección. Puede descargar su resolución en el portal.");

            return ResponseEntity.ok(java.util.Map.of(
                    "mensaje", "Preparando entorno seguro para firma final...",
                    "urlFirma", docuSignRespuesta.get("url")));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Error al aprobar la resolución: " + e.getMessage());
        }
    }

    // =======================================================
    // CU06: 3. BOTÓN "DEVOLVER AL SUPERVISOR"
    // =======================================================
    @PutMapping("/{numeroTicket}/devolver-supervisor")
    public ResponseEntity<?> devolverASupervisor(
            @PathVariable String numeroTicket,
            @RequestBody java.util.Map<String, String> payload,
            @RequestHeader("Authorization") String authHeader,
            jakarta.servlet.http.HttpServletRequest request) {
        try {
            String emailJefe = extraerEmailDelToken(authHeader);
            String motivo = payload.get("observaciones");

            if (motivo == null || motivo.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("Debe ingresar un texto antes de enviar.");
            }

            Queja queja = quejaServicio.obtenerQuejaPorTicket(numeroTicket);
            if (queja == null)
                return ResponseEntity.notFound().build();

            String estadoAnterior = queja.getEstado().getNombre();
            EstadoQueja estadoNuevo = estadoQuejaRepositorio.findByNombre("DevueltaParaRevision");

            queja.setEstado(estadoNuevo);
            quejaRepositorio.save(queja);

            // Bitácora
            String ipCliente = obtenerIpCliente(request);
            com.banco.quejas.modelo.BitacoraQueja bitacora = new com.banco.quejas.modelo.BitacoraQueja(
                    emailJefe, queja.getId(), estadoAnterior, estadoNuevo.getNombre(),
                    "Devuelta a revisión por la Jefatura. Motivo: " + motivo,
                    java.time.LocalDateTime.now(), ipCliente);
            bitacoraQuejaRepositorio.save(bitacora);

            // Mensaje interno
            MensajeQueja mensajeDevolucion = new MensajeQueja(
                    queja, emailJefe, "JEFE",
                    "Dictamen rechazado por la Jefatura: " + motivo,
                    java.time.LocalDateTime.now());
            mensajeQuejaRepositorio.save(mensajeDevolucion);

            return ResponseEntity
                    .ok(java.util.Map.of("mensaje", "La queja ha sido devuelta al nivel anterior para correcciones."));

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error interno: " + e.getMessage());
        }
    }

}