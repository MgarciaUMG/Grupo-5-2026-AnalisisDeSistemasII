package com.banco.quejas.modelo;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "quejas")
public class Queja {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, updatable = false)
    private String numeroTicket;

    @Column(nullable = false)
    private String titulo;

    @Column(nullable = false, length = 1000)
    private String descripcion;

    // Relación con el catálogo de Productos
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "producto_id", nullable = false)
    private Producto producto;

    // Relación con el catálogo de Estados
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "estado_id", nullable = false)
    private EstadoQueja estado;

    @Column(nullable = false)
    private String usuarioEmail;

    @Column(updatable = false)
    private LocalDateTime fechaCreacion;

    @Column(name = "agente_asignado_email")
    private String agenteAsignadoEmail;

    @Column(name = "usuario_nombre")
    private String usuarioNombre;

    @Column(name = "usuario_apellido")
    private String usuarioApellido;

    @Column(name = "resolucion_agente", columnDefinition = "TEXT")
    private String resolucionAgente;

    @Column(name = "observaciones_supervisor", columnDefinition = "TEXT")
    private String observacionesSupervisor;

    @Column(name = "firma_id", length = 100)
    private String firmaId;

    @Column(name = "firma_id_supervisor")
    private String firmaIdSupervisor;

    @Column(name = "firma_id_agente")
    private String firmaIdAgente;

    @ManyToOne
    @JoinColumn(name = "queja_padre_id", nullable = true)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Queja quejaPadre;

    // Este "truco" permite que React reciba el string "QJ-001" en lugar del objeto
    // completo
    @com.fasterxml.jackson.annotation.JsonProperty("numeroTicketPadre")
    public String getNumeroTicketPadre() {
        return this.quejaPadre != null ? this.quejaPadre.getNumeroTicket() : null;
    }

    @PrePersist
    protected void onCreate() {
        this.fechaCreacion = LocalDateTime.now();
        this.numeroTicket = "QJ-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    // Getters y Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNumeroTicket() {
        return numeroTicket;
    }

    public void setNumeroTicket(String numeroTicket) {
        this.numeroTicket = numeroTicket;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public Producto getProducto() {
        return producto;
    }

    public void setProducto(Producto producto) {
        this.producto = producto;
    }

    public EstadoQueja getEstado() {
        return estado;
    }

    public void setEstado(EstadoQueja estado) {
        this.estado = estado;
    }

    public String getUsuarioEmail() {
        return usuarioEmail;
    }

    public void setUsuarioEmail(String usuarioEmail) {
        this.usuarioEmail = usuarioEmail;
    }

    public LocalDateTime getFechaCreacion() {
        return fechaCreacion;
    }

    public void setFechaCreacion(LocalDateTime fechaCreacion) {
        this.fechaCreacion = fechaCreacion;
    }

    // Recuerda generar sus respectivos Getter y Setter al final del archivo:
    public String getAgenteAsignadoEmail() {
        return agenteAsignadoEmail;
    }

    public void setAgenteAsignadoEmail(String agenteAsignadoEmail) {
        this.agenteAsignadoEmail = agenteAsignadoEmail;
    }

    public String getUsuarioNombre() {
        return usuarioNombre;
    }

    public void setUsuarioNombre(String usuarioNombre) {
        this.usuarioNombre = usuarioNombre;
    }

    public String getUsuarioApellido() {
        return usuarioApellido;
    }

    public void setUsuarioApellido(String usuarioApellido) {
        this.usuarioApellido = usuarioApellido;
    }

    public String getResolucionAgente() {
        return resolucionAgente;
    }

    public void setResolucionAgente(String resolucionAgente) {
        this.resolucionAgente = resolucionAgente;
    }

    public String getObservacionesSupervisor() {
        return observacionesSupervisor;
    }

    public void setObservacionesSupervisor(String observacionesSupervisor) {
        this.observacionesSupervisor = observacionesSupervisor;
    }

    public String getFirmaId() {
        return firmaId;
    }

    public void setFirmaId(String firmaId) {
        this.firmaId = firmaId;
    }

    public Queja getQuejaPadre() {
        return quejaPadre;
    }

    public void setQuejaPadre(Queja quejaPadre) {
        this.quejaPadre = quejaPadre;
    }

    public String getFirmaIdSupervisor() {
        return firmaIdSupervisor;
    }

    public void setFirmaIdSupervisor(String firmaIdSupervisor) {
        this.firmaIdSupervisor = firmaIdSupervisor;
    }

    public String getFirmaIdAgente() {
        return firmaIdAgente;
    }

    public void setFirmaIdAgente(String firmaIdAgente) {
        this.firmaIdAgente = firmaIdAgente;
    }

}