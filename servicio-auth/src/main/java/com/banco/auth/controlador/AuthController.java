package com.banco.auth.controlador;

import com.banco.auth.dto.JwtDto;
import com.banco.auth.dto.LoginUsuario;
import com.banco.auth.modelo.Bitacora;
import com.banco.auth.modelo.SolicitudActivacion;
import com.banco.auth.modelo.Usuario;
import com.banco.auth.repositorio.BitacoraRepositorio;
import com.banco.auth.repositorio.SolicitudActivacionRepositorio;
import com.banco.auth.repositorio.UsuarioRepositorio;
import com.banco.auth.seguridad.JwtProvider;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*") // Permite peticiones desde el frontend en desarrollo
public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private JwtProvider jwtProvider;

    @Autowired
    private UsuarioRepositorio usuarioRepositorio;

    @Autowired
    private BitacoraRepositorio bitacoraRepositorio;

    @Autowired
    private SolicitudActivacionRepositorio solicitudActivacionRepositorio;

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginUsuario loginUsuario,
            jakarta.servlet.http.HttpServletRequest request) {

        // 1. Validar si el usuario existe y si está inactivo (Flujo Alterno FA05)
        Optional<Usuario> usuarioOpt = usuarioRepositorio.findByEmail(loginUsuario.getEmail());

        if (usuarioOpt.isPresent()) {
            Usuario usuario = usuarioOpt.get();
            if (!usuario.isActivo()) {
                // El sistema detecta que el usuario está deshabilitado y devuelve el error 403
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                        Map.of(
                                "error", "CUENTA_INACTIVA",
                                "mensaje", "Su cuenta se encuentra inactiva."));
            }
        }

        // 2. Autenticamos al usuario (Valida que la contraseña sea correcta)
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginUsuario.getEmail(), loginUsuario.getPassword()));

        // Colocamos la autenticación en el contexto de seguridad
        SecurityContextHolder.getContext().setAuthentication(authentication);

        // 3. Generamos el token JWT
        String jwt = jwtProvider.generarToken(authentication);

        // 4. El sistema identifica el rol del usuario
        String rolPrincipal = authentication.getAuthorities().iterator().next().getAuthority();

        Usuario usuarioLogueado = usuarioOpt.orElse(null);
        String nombre = (usuarioLogueado != null) ? usuarioLogueado.getNombre() : "";
        String apellido = (usuarioLogueado != null) ? usuarioLogueado.getApellido() : "";

        String ipCliente = obtenerIpCliente(request);

        // 5. El sistema registra el evento en la bitácora de auditoría (Usuario,
        // Fecha/Hora, Rol)
        try {
            Bitacora registro = new Bitacora(
                    loginUsuario.getEmail(),
                    LocalDateTime.now(),
                    rolPrincipal,
                    "LOGIN_EXITOSO",
                    ipCliente);
            bitacoraRepositorio.save(registro);
        } catch (Exception e) {
            System.err.println("Advertencia: No se pudo registrar en la bitácora: " + e.getMessage());
        }

        // 6. Instanciamos el DTO pasándole el token y el rol
        JwtDto jwtDto = new JwtDto(jwt, rolPrincipal, nombre, apellido);

        // 7. Devolvemos el DTO completo al Frontend
        return new ResponseEntity<>(jwtDto, HttpStatus.OK);
    }

    // Endpoint del Flujo Alterno FA05: Solicitud de activación de usuario
    @PostMapping("/solicitar-activacion")
    public ResponseEntity<?> solicitarActivacion(@RequestBody Map<String, String> payload,
            jakarta.servlet.http.HttpServletRequest request) {
        String email = payload.get("usuario");
        String motivo = payload.get("motivo");

        try {
            // 1. REGISTRO 1: Mantenemos la inmutabilidad guardando en la Bitácora de
            // Auditoría
            Bitacora registro = new Bitacora(
                    email,
                    LocalDateTime.now(),
                    "N/A", // El rol es irrelevante aquí porque la cuenta está inactiva
                    "SOLICITUD_ACTIVACION: " + motivo,
                    obtenerIpCliente(request));
            bitacoraRepositorio.save(registro);

            // 2. REGISTRO 2: APARTE, guardamos el estado PENDIENTE en la nueva tabla de
            // gestión
            SolicitudActivacion solicitud = new SolicitudActivacion(
                    email,
                    motivo,
                    LocalDateTime.now(),
                    "PENDIENTE");
            solicitudActivacionRepositorio.save(solicitud);

            System.out.println("Solicitud registrada en bitácora y guardada en la tabla de solicitudes para: " + email);
        } catch (Exception e) {
            System.err.println("Error procesando solicitud: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("mensaje", "Error interno al procesar la solicitud."));
        }

        return ResponseEntity.ok(Map.of("mensaje", "Solicitud de activación enviada al administrador con éxito."));
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

}