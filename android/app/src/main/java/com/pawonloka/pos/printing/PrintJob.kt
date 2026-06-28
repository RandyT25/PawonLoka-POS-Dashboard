package com.pawonloka.pos.printing

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "print_jobs")
data class PrintJob(
    @PrimaryKey val id: String,
    val station: String,       // "kitchen" | "snack" | "bar" | "receipt"
    val type: String,          // "receipt" | "kitchen" | "prebill" | "test"
    val payload: String,       // JSON string with structured print data
    val status: String = "pending",  // "pending" | "printing" | "done" | "failed"
    val retryCount: Int = 0,
    val createdAt: Long = System.currentTimeMillis(),
    val errorMessage: String? = null
)
