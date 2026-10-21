package com.banco.quejas.repositorio;

import com.banco.quejas.modelo.Queja;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface QuejaRepositorio extends JpaRepository<Queja, Long> {

        public interface BitacoraQuejaDTO {
                Long getId();

                LocalDateTime getFecha(); // Mapea a AS fecha

                String getNumeroTicket(); // Mapea a AS numeroTicket

                String getUsuario(); // Mapea a AS usuario

                String getDescripcion(); // Mapea a AS descripcion

                String getIp(); // Mapea a AS ip
        }

        // Para listar todas las quejas de un cliente en su dashboard
        List<Queja> findByUsuarioEmail(String usuarioEmail);

        // Buscar todas las quejas que le pertenecen a un agente específico
        List<Queja> findByAgenteAsignadoEmail(String agenteAsignadoEmail);

        // NUEVO: Para buscar una queja exacta por su código de ticket (ej. QJ-1234)
        Queja findByNumeroTicket(String numeroTicket);

        // Busca las quejas dependiendo de su estado (ej. "EnRevisionSupervisor")
        List<Queja> findByEstado(com.banco.quejas.modelo.EstadoQueja estado);

        // Buscar todas las quejas que nacieron a partir de una queja principal
        List<Queja> findByQuejaPadreId(Long quejaPadreId);

        @Query(value = "SELECT u.email " +
                        "FROM usuarios u " +
                        "INNER JOIN usuario_roles ur ON u.id = ur.usuario_id " +
                        "INNER JOIN roles r ON ur.rol_id = r.id " +
                        "LEFT JOIN quejas q ON u.email = q.agente_asignado_email " +
                        "    AND q.estado_id = (SELECT id FROM catalogo_estados WHERE nombre = 'EnValidacion') " +
                        "WHERE r.nombre = 'ROLE_AGENTE_BANCARIO' AND u.activo = true " +
                        "GROUP BY u.email " +
                        "ORDER BY COUNT(q.id) ASC " +
                        "LIMIT 1", nativeQuery = true)
        String encontrarAgenteConMenorCarga();

        // NUEVA CONSULTA PARA AUDITORÍA EN CONSOLA (Trae a todos los agentes y su
        // cantidad de quejas)
        @Query(value = "SELECT u.email, COUNT(q.id) as cantidad " +
                        "FROM usuarios u " +
                        "INNER JOIN usuario_roles ur ON u.id = ur.usuario_id " +
                        "INNER JOIN roles r ON ur.rol_id = r.id " +
                        "LEFT JOIN quejas q ON u.email = q.agente_asignado_email " +
                        "    AND q.estado_id = (SELECT id FROM catalogo_estados WHERE nombre = 'EnValidacion') " +
                        "WHERE r.nombre = 'ROLE_AGENTE_BANCARIO' AND u.activo = true " +
                        "GROUP BY u.email " +
                        "ORDER BY COUNT(q.id) ASC", nativeQuery = true)
        List<Object[]> obtenerCargaDeTodosLosAgentes();

        // Busca todas las quejas cuyo estado sea "PendienteDeAsignacion"
        @Query("SELECT q FROM Queja q WHERE q.estado.nombre = 'PendienteDeAsignacion'")
        java.util.List<Queja> encontrarQuejasPendientes();

        @Query(value = "SELECT CAST(id AS VARCHAR) as id, nombre, apellido FROM usuarios WHERE email = :email", nativeQuery = true)
        UsuarioProyeccion buscarDatosUsuarioPorEmail(
                        @org.springframework.data.repository.query.Param("email") String email);

        // Interfaz interna para recibir los datos de la consulta nativa
        public interface UsuarioProyeccion {
                String getId();

                String getNombre();

                String getApellido();
        }

        // ====================================================================
        // CONSULTAS NATIVAS PARA EL PORTAL ADMIN (Sin necesidad de entidades)
        // ====================================================================

        @Query(value = "SELECT ce.nombre, COUNT(q.id) FROM catalogo_estados ce LEFT JOIN quejas q ON ce.id = q.estado_id GROUP BY ce.nombre", nativeQuery = true)
        List<Object[]> contarQuejasPorEstado();

        @Query(value = "SELECT agente_asignado_email, COUNT(id) FROM quejas WHERE agente_asignado_email IS NOT NULL GROUP BY agente_asignado_email", nativeQuery = true)
        List<Object[]> contarQuejasPorUsuario();

        public interface UsuarioAdminProyeccion {
                String getId();

                String getEmail();

                String getNombre();

                String getApellido();

                String getRol();

                Boolean getActivo();
        }

        @Query(value = "SELECT CAST(u.id AS VARCHAR) as id, u.email, u.nombre, u.apellido, r.nombre as rol, u.activo " +
                        "FROM usuarios u " +
                        "LEFT JOIN usuario_roles ur ON u.id = ur.usuario_id " +
                        "LEFT JOIN roles r ON ur.rol_id = r.id", nativeQuery = true)
        List<UsuarioAdminProyeccion> listarUsuariosAdmin();

        @org.springframework.data.jpa.repository.Modifying
        @org.springframework.transaction.annotation.Transactional
        @Query(value = "UPDATE usuarios SET activo = NOT activo WHERE id = CAST(:id AS uuid)", nativeQuery = true)
        int toggleEstadoUsuario(@org.springframework.data.repository.query.Param("id") String id);

        // 2. Proyección y consulta para la Bitácora de Auth
        public interface BitacoraAuthProyeccion {
                Long getId();

                String getUsuario();

                String getRol();

                String getAccion();

                String getFechaHora();

                String getDireccionIp();
        }

        @Query(value = "SELECT id, usuario, rol, accion, CAST(fecha_hora AS VARCHAR) as fechaHora, direccion_ip as direccionIp FROM bitacora_auditoria", nativeQuery = true)
        List<BitacoraAuthProyeccion> listarBitacoraAuth();

        @Query(value = "SELECT usuario_email, COUNT(id) FROM quejas GROUP BY usuario_email", nativeQuery = true)
        List<Object[]> contarQuejasPorCliente();

        @Query(value = """
                        SELECT
                            b.id,
                            b.fecha_hora AS fecha,
                            q.numero_ticket AS numeroTicket,
                            b.usuario_email AS usuario,
                            b.descripcion_evento AS descripcion,
                            b.direccion_ip AS ip
                        FROM bitacora_quejas b
                        LEFT JOIN quejas q ON b.queja_id = q.id
                        ORDER BY b.fecha_hora DESC
                        """, nativeQuery = true)
        List<BitacoraQuejaDTO> obtenerBitacoraQuejas();

        public interface SolicitudProyeccion {
                Long getId();

                String getEmail();

                String getMotivo();

                String getFecha();

                String getUsuarioId();
        }

        // Lee únicamente las pendientes de la tabla que creó servicio-auth
        @Query(value = "SELECT s.id, s.email, s.motivo, CAST(s.fecha_hora AS VARCHAR) as fecha, CAST(u.id AS VARCHAR) as usuarioId "
                        +
                        "FROM solicitudes_activacion s " +
                        "INNER JOIN usuarios u ON s.email = u.email " +
                        "WHERE s.estado = 'PENDIENTE' ORDER BY s.fecha_hora DESC", nativeQuery = true)
        List<SolicitudProyeccion> listarSolicitudesPendientes();

        @org.springframework.data.jpa.repository.Modifying
        @org.springframework.transaction.annotation.Transactional
        @Query(value = "UPDATE solicitudes_activacion SET estado = 'APROBADA' WHERE email = (SELECT email FROM usuarios WHERE id = CAST(:id AS uuid)) AND estado = 'PENDIENTE'", nativeQuery = true)
        void aprobarSolicitudPorUsuarioId(@org.springframework.data.repository.query.Param("id") String id);

        @org.springframework.data.jpa.repository.Modifying
        @org.springframework.transaction.annotation.Transactional
        @Query(value = "INSERT INTO bitacora_auditoria (usuario, fecha_hora, rol, accion, direccion_ip) " +
                        "SELECT :adminEmail, CURRENT_TIMESTAMP, 'ADMIN', " +
                        "CASE WHEN activo = true THEN 'ACTIVACION_CUENTA: Se aprobó y activó al usuario ' || email " +
                        "ELSE 'DESACTIVACION_CUENTA: Se inhabilitó al usuario ' || email END, " +
                        ":ip FROM usuarios WHERE id = CAST(:usuarioId AS uuid)", nativeQuery = true)
        void registrarCambioEstadoAuditoria(
                        @org.springframework.data.repository.query.Param("adminEmail") String adminEmail,
                        @org.springframework.data.repository.query.Param("usuarioId") String usuarioId,
                        @org.springframework.data.repository.query.Param("ip") String ip);

}