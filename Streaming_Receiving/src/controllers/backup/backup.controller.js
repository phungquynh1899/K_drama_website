const backupService = require('../../services/backup/backup.service');

exports.receiveFile = (req, res, next) => {
  backupService.receiveFile(req, res, next);
};

exports.completeBackup = (req, res, next) => {
  backupService.completeBackup(req, res, next);
};

exports.cancelJob = (req, res, next) => {
  backupService.cancelJob(req, res, next);
}

exports.getBackupStatus = (req, res, next) => {
  backupService.getBackupStatus(req, res, next);
}; 