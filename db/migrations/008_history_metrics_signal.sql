ALTER TABLE commit_signals
    DROP CONSTRAINT IF EXISTS commit_signals_signal_type_check;

ALTER TABLE commit_signals
    ADD CONSTRAINT commit_signals_signal_type_check
    CHECK (signal_type IN (
        'big_bang_commit',
        'zombie_code',
        'low_message_entropy',
        'history_metrics'
    ));