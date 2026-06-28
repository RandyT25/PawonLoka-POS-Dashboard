package com.pawonloka.pos.printing

import android.content.Context
import androidx.room.*

@Dao
interface PrintJobDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertJob(job: PrintJob)

    @Query("SELECT * FROM print_jobs WHERE station = :station AND status = 'pending' ORDER BY createdAt ASC")
    suspend fun getPendingJobs(station: String): List<PrintJob>

    @Query("SELECT * FROM print_jobs WHERE status = 'pending' ORDER BY createdAt ASC")
    suspend fun getAllPending(): List<PrintJob>

    @Query("UPDATE print_jobs SET status = :status, errorMessage = :errorMessage WHERE id = :id")
    suspend fun updateStatus(id: String, status: String, errorMessage: String?)

    @Query("UPDATE print_jobs SET status = :status, errorMessage = NULL WHERE id = :id")
    suspend fun updateStatusNoError(id: String, status: String)

    @Query("UPDATE print_jobs SET retryCount = retryCount + 1, status = 'pending' WHERE id = :id")
    suspend fun incrementRetry(id: String)

    @Query("DELETE FROM print_jobs WHERE status = 'done' AND createdAt < :cutoff")
    suspend fun deleteDoneJobsBefore(cutoff: Long)
}

@Database(entities = [PrintJob::class], version = 1, exportSchema = false)
abstract class PrintDatabase : RoomDatabase() {
    abstract fun printJobDao(): PrintJobDao

    companion object {
        @Volatile private var INSTANCE: PrintDatabase? = null

        fun get(context: Context): PrintDatabase = INSTANCE ?: synchronized(this) {
            INSTANCE ?: Room.databaseBuilder(
                context.applicationContext,
                PrintDatabase::class.java,
                "print_queue.db"
            ).build().also { INSTANCE = it }
        }
    }
}
