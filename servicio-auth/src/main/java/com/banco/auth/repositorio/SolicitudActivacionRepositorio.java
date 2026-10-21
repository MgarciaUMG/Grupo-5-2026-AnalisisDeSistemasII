package com.banco.auth.repositorio;

import com.banco.auth.modelo.SolicitudActivacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

public interface SolicitudActivacionRepositorio extends JpaRepository<SolicitudActivacion, Long> {

    // Buscar solo las pendientes
    List<SolicitudActivacion> findByEstado(String estado);

    // Marcar como aprobada cuando el admin active al usuario
    @Modifying
    @Transactional
    @Query("UPDATE SolicitudActivacion s SET s.estado = 'APROBADA' WHERE s.email = :email AND s.estado = 'PENDIENTE'")
    void aprobarSolicitudesPorEmail(@Param("email") String email);
}
