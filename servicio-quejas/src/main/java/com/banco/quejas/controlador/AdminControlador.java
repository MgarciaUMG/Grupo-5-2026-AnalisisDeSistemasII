package com.banco.quejas.controlador;

import com.banco.quejas.modelo.BitacoraQueja;
import com.banco.quejas.repositorio.QuejaRepositorio;
import com.banco.quejas.repositorio.BitacoraQuejaRepositorio;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/quejas/admin")
public class AdminControlador {

    @Autowired
    private QuejaRepositorio quejaRepositorio;

    @Autowired
    private BitacoraQuejaRepositorio bitacoraQuejaRepositorio;

    // ==========================================
    // 1. ESTADÍSTICAS
    // ==========================================
    @GetMapping("/estadisticas")
    public ResponseEntity<?> obtenerEstadisticas(@RequestHeader("Authorization") String authHeader) {
        try {
            long totalQuejas = quejaRepositorio.count();

            List<Map<String, Object>> statsEstados = quejaRepositorio.contarQuejasPorEstado().stream()
                    .map(obj -> Map.of("estado", obj[0] != null ? obj[0].toString() : "Desconocido", "cantidad",
                            obj[1]))
                    .collect(Collectors.toList());

            List<Map<String, Object>> statsUsuarios = quejaRepositorio.contarQuejasPorUsuario().stream()
                    .map(obj -> Map.of("email", obj[0] != null ? obj[0].toString() : "Sin Asignar", "cantidad", obj[1]))
                    .collect(Collectors.toList());

            List<Map<String, Object>> statsClientes = quejaRepositorio.contarQuejasPorCliente().stream()
                    .map(obj -> Map.<String, Object>of("email", obj[0] != null ? obj[0].toString() : "Desconocido",
                            "cantidad", obj[1]))
                    .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of(
                    "total", totalQuejas,
                    "porEstado", statsEstados,
                    "porUsuario", statsUsuarios,
                    "porCliente", statsClientes));
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error al cargar estadísticas.");
        }
    }

    // ==========================================
    // 2. GESTIÓN DE USUARIOS
    // ==========================================
    @GetMapping("/usuarios")
    public ResponseEntity<?> listarUsuarios(@RequestHeader("Authorization") String authHeader) {
        try {
            List<QuejaRepositorio.UsuarioAdminProyeccion> usuariosBD = quejaRepositorio.listarUsuariosAdmin();

            List<Map<String, Object>> usuariosMapeados = usuariosBD.stream().map(u -> Map.<String, Object>of(
                    "id", u.getId(),
                    "email", u.getEmail() != null ? u.getEmail() : "",
                    "nombreCompleto",
                    (u.getNombre() != null ? u.getNombre() : "") + " "
                            + (u.getApellido() != null ? u.getApellido() : ""),
                    "rol", u.getRol() != null ? u.getRol().replace("ROLE_", "") : "SIN ROL",
                    "activo", u.getActivo() != null ? u.getActivo() : false)).collect(Collectors.toList());

            return ResponseEntity.ok(usuariosMapeados);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error al obtener usuarios: " + e.getMessage());
        }
    }

    @PutMapping("/usuarios/{id}/toggle-estado")
    public ResponseEntity<?> cambiarEstadoUsuario(@PathVariable String id,
            @RequestHeader("Authorization") String authHeader) {
        try {
            int actualizados = quejaRepositorio.toggleEstadoUsuario(id);
            if (actualizados == 0)
                return ResponseEntity.notFound().build();

            return ResponseEntity.ok(Map.of("mensaje", "Estado del usuario actualizado exitosamente."));
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error al actualizar estado del usuario.");
        }
    }

    // ==========================================
    // 3. BITÁCORAS SEPARADAS
    // ==========================================
    @GetMapping("/bitacora")
    public ResponseEntity<?> obtenerBitacora(@RequestHeader("Authorization") String authHeader) {
        try {
            List<Map<String, Object>> logsAuthList = new ArrayList<>();
            List<QuejaRepositorio.BitacoraAuthProyeccion> logsAuth = quejaRepositorio.listarBitacoraAuth();
            for (QuejaRepositorio.BitacoraAuthProyeccion b : logsAuth) {
                logsAuthList.add(Map.<String, Object>of(
                        "id", "AUTH-" + b.getId(),
                        "usuario", b.getUsuario() != null ? b.getUsuario() : "Desconocido",
                        "rol", b.getRol() != null ? b.getRol() : "N/A",
                        "descripcion", b.getAccion() != null ? b.getAccion() : "",
                        "fecha", b.getFechaHora() != null ? b.getFechaHora() : "",
                        "ip", b.getDireccionIp() != null ? b.getDireccionIp() : "Desconocida"));
            }

            List<Map<String, Object>> logsQuejasList = new ArrayList<>();

            // CORRECCIÓN: Ahora apuntamos a QuejaRepositorio en ambos lados
            List<QuejaRepositorio.BitacoraQuejaDTO> logsQuejas = quejaRepositorio.obtenerBitacoraQuejas();

            for (QuejaRepositorio.BitacoraQuejaDTO bq : logsQuejas) {
                Map<String, Object> logMap = new HashMap<>();

                logMap.put("id", bq.getId());
                logMap.put("numeroTicket", bq.getNumeroTicket() != null ? bq.getNumeroTicket() : "");
                logMap.put("usuario", bq.getUsuario() != null ? bq.getUsuario() : "Desconocido");
                logMap.put("rol", "N/A"); // Las quejas no guardan el rol
                logMap.put("descripcion", bq.getDescripcion() != null ? bq.getDescripcion() : "");
                logMap.put("fecha", bq.getFecha() != null ? bq.getFecha().toString() : "");
                logMap.put("ip", bq.getIp() != null ? bq.getIp() : "Desconocida");

                logsQuejasList.add(logMap);
            }

            // ==========================================
            // 3. ORDENAMIENTO Y RETORNO
            // ==========================================
            logsAuthList.sort((a, b) -> b.get("fecha").toString().compareTo(a.get("fecha").toString()));
            // Ya no necesitas ordenar logsQuejasList aquí si ya le pusiste 'ORDER BY
            // b.fecha_hora DESC' en tu SQL,
            // pero lo dejamos por seguridad.
            logsQuejasList.sort((a, b) -> b.get("fecha").toString().compareTo(a.get("fecha").toString()));

            // Retornamos un objeto con dos arreglos distintos
            return ResponseEntity.ok(Map.of("auth", logsAuthList, "quejas", logsQuejasList));

        } catch (Exception e) {
            e.printStackTrace(); // Recomendado para ver el error exacto en consola si algo falla
            return ResponseEntity.status(500).body("Error al cargar bitácoras.");
        }
    }

    @GetMapping("/solicitudes")
    public ResponseEntity<?> obtenerSolicitudes(@RequestHeader("Authorization") String authHeader) {
        try {
            List<Map<String, Object>> solicitudes = quejaRepositorio.listarSolicitudesPendientes().stream()
                    .map(s -> Map.<String, Object>of(
                            "id", s.getId(),
                            "email", s.getEmail() != null ? s.getEmail() : "",
                            "motivo", s.getMotivo() != null ? s.getMotivo() : "",
                            "fecha", s.getFecha() != null ? s.getFecha().substring(0, 19).replace("T", " ") : ""))
                    .collect(Collectors.toList());

            return ResponseEntity.ok(solicitudes);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }
}