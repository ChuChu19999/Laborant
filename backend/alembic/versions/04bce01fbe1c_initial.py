"""initial

Revision ID: 04bce01fbe1c
Revises:
Create Date: 2026-08-11 09:59:44.250745

"""
import sqlalchemy as sa
from alembic import op
from core.config import get_database_schema

revision = '04bce01fbe1c'
down_revision = None
branch_labels = None
depends_on = None

SCHEMA = get_database_schema()


def upgrade() -> None:
    op.create_table('laboratories',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False, comment='Аббревиатура'),
    sa.Column('full_name', sa.String(length=255), nullable=False, comment='Полное название'),
    sa.Column('laboratory_location', sa.String(length=255), nullable=True, comment='Место осуществления лабораторной деятельности'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('unique_laboratory_name', 'laboratories', ['name'], unique=True, schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_table('research_method_groups',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False, comment='Наименование группы методов исследования'),
    sa.Column('sort_order', sa.Integer(), nullable=True, comment='Порядок сортировки группы'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('idx_research_method_group_name', 'research_method_groups', ['name'], unique=False, schema=SCHEMA)
    op.create_index('idx_research_method_group_sort_order', 'research_method_groups', ['sort_order'], unique=False, schema=SCHEMA)
    op.create_table('roles',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False, comment='Наименование роли'),
    sa.Column('role_type', sa.String(length=20), nullable=False, comment='Тип роли: laborant, engineer'),
    sa.Column('scopes', sa.JSON(), nullable=False, comment='Привязки: laboratory_id, department_id, permissions'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.CheckConstraint("role_type IN ('laborant', 'engineer')", name='ck_roles_role_type'),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('unique_role_name_type', 'roles', ['name', 'role_type'], unique=True, schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_table('test_objects',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False, comment='Наименование объекта испытаний'),
    sa.Column('tag', sa.String(length=50), nullable=False, comment='Тег для связи с методами исследования'),
    sa.Column('protocol_abbreviation', sa.String(length=8), nullable=True, comment='Аббревиатура для номера протокола'),
    sa.Column('visibility_scope', sa.JSON(), nullable=False, comment='Область видимости: laboratory_ids, department_ids'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('idx_test_object_tag', 'test_objects', ['tag'], unique=False, schema=SCHEMA)
    op.create_index('unique_test_object_name', 'test_objects', ['name'], unique=True, schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_table('departments',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('laboratory_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False, comment='Название подразделения'),
    sa.Column('laboratory_location', sa.String(length=255), nullable=False, comment='Место осуществления лабораторной деятельности'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.ForeignKeyConstraint(['laboratory_id'], [f'{SCHEMA}.laboratories.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('unique_department_name_per_laboratory', 'departments', ['laboratory_id', 'name'], unique=True, schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_table('branches',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False, comment='Название филиала'),
    sa.Column('phone', sa.String(length=20), nullable=True, comment='Номер телефона филиала'),
    sa.Column('laboratory_id', sa.Integer(), nullable=False),
    sa.Column('department_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.ForeignKeyConstraint(['department_id'], [f'{SCHEMA}.departments.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['laboratory_id'], [f'{SCHEMA}.laboratories.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('idx_branch_department', 'branches', ['department_id'], unique=False, schema=SCHEMA)
    op.create_index('idx_branch_laboratory', 'branches', ['laboratory_id'], unique=False, schema=SCHEMA)
    op.create_index('idx_branch_name', 'branches', ['name'], unique=False, schema=SCHEMA)
    op.create_table('equipments',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False, comment='Тип прибора или оборудования'),
    sa.Column('name', sa.String(length=255), nullable=False, comment='Наименование прибора или оборудования'),
    sa.Column('serial_number', sa.String(length=100), nullable=False, comment='Заводской номер прибора или оборудования'),
    sa.Column('verification_info', sa.String(length=255), nullable=False, comment='Сведения о результатах поверки'),
    sa.Column('verification_date', sa.Date(), nullable=False, comment='Дата поверки'),
    sa.Column('verification_end_date', sa.Date(), nullable=False, comment='Дата окончания срока действия поверки'),
    sa.Column('version', sa.String(length=8), nullable=False, comment='Версия прибора (например, v1)'),
    sa.Column('laboratory_id', sa.Integer(), nullable=False),
    sa.Column('department_id', sa.Integer(), nullable=True),
    sa.Column('method_data_default', sa.JSON(), nullable=True, comment='Методы, которым доступен прибор'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.CheckConstraint("type IN ('measuring_instrument', 'test_equipment')", name='ck_equipments_type'),
    sa.ForeignKeyConstraint(['department_id'], [f'{SCHEMA}.departments.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['laboratory_id'], [f'{SCHEMA}.laboratories.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('idx_equipment_name', 'equipments', ['name'], unique=False, schema=SCHEMA)
    op.create_index('idx_equipment_type', 'equipments', ['type'], unique=False, schema=SCHEMA)
    op.create_index('idx_equipment_verification_end_date', 'equipments', ['verification_end_date'], unique=False, schema=SCHEMA)
    op.create_table('nd_norms',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False, comment='Наименование нормы'),
    sa.Column('test_object', sa.String(length=255), nullable=False, comment='Объект испытаний'),
    sa.Column('laboratory_id', sa.Integer(), nullable=False),
    sa.Column('department_id', sa.Integer(), nullable=True),
    sa.Column('method_data', sa.JSON(), nullable=False, comment='Значения нормы по методам: method_id и value'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.ForeignKeyConstraint(['department_id'], [f'{SCHEMA}.departments.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['laboratory_id'], [f'{SCHEMA}.laboratories.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('idx_nd_norm_name', 'nd_norms', ['name'], unique=False, schema=SCHEMA)
    op.create_index('idx_nd_norm_test_object', 'nd_norms', ['test_object'], unique=False, schema=SCHEMA)
    op.create_table('protocol_templates',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False, comment='Название шаблона'),
    sa.Column('version', sa.String(length=8), nullable=False, comment='Версия шаблона (например, v1)'),
    sa.Column('file', sa.String(), nullable=False, comment='xlsx файл'),
    sa.Column('file_name', sa.String(length=100), nullable=False, comment='Имя файла'),
    sa.Column('laboratory_id', sa.Integer(), nullable=False),
    sa.Column('department_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.ForeignKeyConstraint(['department_id'], [f'{SCHEMA}.departments.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['laboratory_id'], [f'{SCHEMA}.laboratories.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('idx_protocol_template_department', 'protocol_templates', ['department_id'], unique=False, schema=SCHEMA)
    op.create_index('idx_protocol_template_laboratory', 'protocol_templates', ['laboratory_id'], unique=False, schema=SCHEMA)
    op.create_index('idx_protocol_template_name', 'protocol_templates', ['name'], unique=False, schema=SCHEMA)
    op.create_table('report_templates',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('report_type', sa.String(length=255), nullable=False, comment='Тип отчета'),
    sa.Column('version', sa.String(length=8), nullable=False, comment='Версия шаблона (например, v1)'),
    sa.Column('file', sa.String(), nullable=False, comment='Файл (base64)'),
    sa.Column('file_name', sa.String(length=255), nullable=False, comment='Имя файла'),
    sa.Column('laboratory_id', sa.Integer(), nullable=False),
    sa.Column('department_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.CheckConstraint("report_type IN ('Количество проб', 'Физико-химическая характеристика', 'Результаты КГС', 'Результаты НКС')", name='ck_report_templates_report_type'),
    sa.ForeignKeyConstraint(['department_id'], [f'{SCHEMA}.departments.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['laboratory_id'], [f'{SCHEMA}.laboratories.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('idx_report_template_department', 'report_templates', ['department_id'], unique=False, schema=SCHEMA)
    op.create_index('idx_report_template_laboratory', 'report_templates', ['laboratory_id'], unique=False, schema=SCHEMA)
    op.create_index('idx_report_template_type', 'report_templates', ['report_type'], unique=False, schema=SCHEMA)
    op.create_table('research_methods',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False, comment='Наименование метода исследования'),
    sa.Column('sample_type', sa.JSON(), nullable=False, comment='Типы исследуемых проб'),
    sa.Column('formula', sa.String(length=255), nullable=False, comment='Формула для расчёта'),
    sa.Column('measurement_error', sa.JSON(), nullable=False, comment='Погрешность измерения'),
    sa.Column('unit', sa.String(length=20), nullable=False, comment='Единица измерения результата'),
    sa.Column('measurement_method', sa.String(length=255), nullable=False, comment='Метод измерения'),
    sa.Column('nd_code', sa.String(length=255), nullable=False, comment='Шифр НД'),
    sa.Column('nd_name', sa.String(length=255), nullable=False, comment='Наименование НД'),
    sa.Column('input_data', sa.JSON(), nullable=False, comment='Структура входных данных'),
    sa.Column('intermediate_data', sa.JSON(), nullable=False, comment='Структура промежуточных данных'),
    sa.Column('convergence_conditions', sa.JSON(), nullable=False, comment='Условия повторяемости'),
    sa.Column('rounding_type', sa.String(length=20), nullable=False, comment='Тип округления'),
    sa.Column('rounding_decimal', sa.Integer(), nullable=False, comment='Количество знаков округления'),
    sa.Column('is_group_member', sa.Boolean(), nullable=False, comment='Является частью группы'),
    sa.Column('equipment_data_default', sa.JSON(), nullable=True, comment='Приборы по умолчанию'),
    sa.Column('sort_order', sa.Integer(), nullable=True, comment='Порядок сортировки'),
    sa.Column('laboratory_id', sa.Integer(), nullable=True),
    sa.Column('department_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.CheckConstraint("rounding_type IN ('decimal', 'significant')", name='ck_research_methods_rounding_type'),
    sa.ForeignKeyConstraint(['department_id'], [f'{SCHEMA}.departments.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['laboratory_id'], [f'{SCHEMA}.laboratories.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('idx_research_method_department', 'research_methods', ['department_id'], unique=False, schema=SCHEMA)
    op.create_index('idx_research_method_laboratory', 'research_methods', ['laboratory_id'], unique=False, schema=SCHEMA)
    op.create_index('idx_research_method_name', 'research_methods', ['name'], unique=False, schema=SCHEMA)
    op.create_index('idx_research_method_rounding_type', 'research_methods', ['rounding_type'], unique=False, schema=SCHEMA)
    op.create_index('idx_research_method_sort_order', 'research_methods', ['sort_order'], unique=False, schema=SCHEMA)
    op.create_table('selection_conditions',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('conditions', sa.JSON(), nullable=False, comment='JSON с условиями отбора и их единицами измерения'),
    sa.Column('laboratory_id', sa.Integer(), nullable=True),
    sa.Column('department_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.ForeignKeyConstraint(['department_id'], [f'{SCHEMA}.departments.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['laboratory_id'], [f'{SCHEMA}.laboratories.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('idx_selection_conditions_department', 'selection_conditions', ['department_id'], unique=False, schema=SCHEMA)
    op.create_index('idx_selection_conditions_laboratory', 'selection_conditions', ['laboratory_id'], unique=False, schema=SCHEMA)
    op.create_table('mass_fraction_oil_refraction_tables',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('research_method_id', sa.Integer(), nullable=False),
    sa.Column('c_value', sa.String(length=10), nullable=False, comment='Массовая доля нефти (C) в процентах'),
    sa.Column('n_value', sa.String(length=10), nullable=False, comment='Показатель преломления (n)'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.ForeignKeyConstraint(['research_method_id'], [f'{SCHEMA}.research_methods.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('idx_refraction_table_research_method_c', 'mass_fraction_oil_refraction_tables', ['research_method_id', 'c_value'], unique=False, schema=SCHEMA)
    op.create_table('protocols',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('test_protocol_number', sa.String(length=100), nullable=True, comment='Номер протокола испытаний'),
    sa.Column('test_protocol_date', sa.Date(), nullable=True, comment='Дата протокола испытаний'),
    sa.Column('is_accredited', sa.Boolean(), nullable=False, comment='Признак аккредитации протокола'),
    sa.Column('sampling_act_number', sa.String(length=50), nullable=False, comment='Номер акта отбора'),
    sa.Column('issued', sa.String(length=150), nullable=True, comment='hsnils лица, оформившего протокол'),
    sa.Column('approved', sa.String(length=150), nullable=True, comment='hsnils лица, утвердившего протокол'),
    sa.Column('issued_position', sa.String(length=100), nullable=True, comment='Должность оформившего'),
    sa.Column('approved_position', sa.String(length=100), nullable=True, comment='Должность утвердившего'),
    sa.Column('protocol_template_id', sa.Integer(), nullable=True),
    sa.Column('laboratory_id', sa.Integer(), nullable=False),
    sa.Column('department_id', sa.Integer(), nullable=True),
    sa.Column('samples', sa.JSON(), nullable=True, comment='Массив ID проб, привязанных к протоколу'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.ForeignKeyConstraint(['department_id'], [f'{SCHEMA}.departments.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['laboratory_id'], [f'{SCHEMA}.laboratories.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['protocol_template_id'], [f'{SCHEMA}.protocol_templates.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('idx_protocol_department', 'protocols', ['department_id'], unique=False, schema=SCHEMA)
    op.create_index('idx_protocol_laboratory', 'protocols', ['laboratory_id'], unique=False, schema=SCHEMA)
    op.create_index('idx_protocol_test_protocol_number', 'protocols', ['test_protocol_number'], unique=False, schema=SCHEMA)
    op.create_table('research_method_groups_association',
    sa.Column('research_method_id', sa.Integer(), nullable=False),
    sa.Column('research_method_group_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['research_method_group_id'], [f'{SCHEMA}.research_method_groups.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['research_method_id'], [f'{SCHEMA}.research_methods.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('research_method_id', 'research_method_group_id'),
    schema=SCHEMA
    )
    op.create_table('sampling_locations',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('branch_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False, comment='Название места отбора пробы'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.ForeignKeyConstraint(['branch_id'], [f'{SCHEMA}.branches.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('unique_sampling_location_per_branch', 'sampling_locations', ['branch_id', 'name'], unique=True, schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_table('well_modes',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('branch_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False, comment='Название режима скважины'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.ForeignKeyConstraint(['branch_id'], [f'{SCHEMA}.branches.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('unique_well_mode_per_branch', 'well_modes', ['branch_id', 'name'], unique=True, schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_table('samples',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('registration_number', sa.String(length=50), nullable=False, comment='Регистрационный номер пробы'),
    sa.Column('sample_type', sa.String(length=50), nullable=True, comment='Тип пробы'),
    sa.Column('test_object', sa.String(length=255), nullable=False, comment='Объект испытаний'),
    sa.Column('sampling_date', sa.Date(), nullable=True, comment='Дата отбора пробы'),
    sa.Column('receiving_date', sa.Date(), nullable=True, comment='Дата получения пробы в лабораторию'),
    sa.Column('laboratory_id', sa.Integer(), nullable=False),
    sa.Column('department_id', sa.Integer(), nullable=True),
    sa.Column('branch_id', sa.Integer(), nullable=True),
    sa.Column('sampling_location_id', sa.Integer(), nullable=True),
    sa.Column('well', sa.String(length=255), nullable=True, comment='Название скважины'),
    sa.Column('mode', sa.String(length=255), nullable=True, comment='Режим работы скважины'),
    sa.Column('indicators_count', sa.Integer(), nullable=False, comment='Количество показателей'),
    sa.Column('phone', sa.String(length=50), nullable=True, comment='Номер телефона филиала'),
    sa.Column('selection_conditions', sa.JSON(), nullable=True, comment='JSON с условиями отбора и их значениями'),
    sa.Column('added_by', sa.String(length=150), nullable=True, comment='hsnils лица, добавившего пробу'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.ForeignKeyConstraint(['branch_id'], [f'{SCHEMA}.branches.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['department_id'], [f'{SCHEMA}.departments.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['laboratory_id'], [f'{SCHEMA}.laboratories.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['sampling_location_id'], [f'{SCHEMA}.sampling_locations.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('idx_sample_department', 'samples', ['department_id'], unique=False, schema=SCHEMA)
    op.create_index('idx_sample_laboratory', 'samples', ['laboratory_id'], unique=False, schema=SCHEMA)
    op.create_index('unique_sample_registration_number_per_lab_dept', 'samples', ['registration_number', 'laboratory_id', 'department_id'], unique=True, schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_table('calculations',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('input_data', sa.JSON(), nullable=False, comment='Входные данные для расчёта'),
    sa.Column('equipment_data', sa.JSON(), nullable=True, comment='Список ID приборов'),
    sa.Column('result', sa.Text(), nullable=False, comment='Итоговый результат расчёта'),
    sa.Column('executor', sa.String(length=150), nullable=False, comment='hsnils исполнителя, производившего расчёт'),
    sa.Column('measurement_error', sa.String(length=20), nullable=True, comment='Погрешность измерения результата в формате ±число'),
    sa.Column('unit', sa.String(length=20), nullable=True, comment='Единица измерения результата'),
    sa.Column('laboratory_activity_date', sa.Date(), nullable=False, comment='Дата проведения лабораторного исследования'),
    sa.Column('sample_id', sa.Integer(), nullable=False),
    sa.Column('laboratory_id', sa.Integer(), nullable=False),
    sa.Column('department_id', sa.Integer(), nullable=True),
    sa.Column('research_method_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('created_by_hash', sa.String(length=32), nullable=True),
    sa.Column('updated_by', sa.String(length=255), nullable=True),
    sa.Column('updated_by_hash', sa.String(length=32), nullable=True),
    sa.Column('deleted_by', sa.String(length=255), nullable=True),
    sa.Column('deleted_by_hash', sa.String(length=32), nullable=True),
    sa.ForeignKeyConstraint(['department_id'], [f'{SCHEMA}.departments.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['laboratory_id'], [f'{SCHEMA}.laboratories.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['research_method_id'], [f'{SCHEMA}.research_methods.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['sample_id'], [f'{SCHEMA}.samples.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    schema=SCHEMA
    )
    op.create_index('idx_calculation_department', 'calculations', ['department_id'], unique=False, schema=SCHEMA)
    op.create_index('idx_calculation_laboratory', 'calculations', ['laboratory_id'], unique=False, schema=SCHEMA)
    op.create_index('idx_calculation_research_method', 'calculations', ['research_method_id'], unique=False, schema=SCHEMA)
    op.create_index('unique_sample_method', 'calculations', ['sample_id', 'research_method_id'], unique=True, schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))


def downgrade() -> None:
    op.drop_index('unique_sample_method', table_name='calculations', schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_index('idx_calculation_research_method', table_name='calculations', schema=SCHEMA)
    op.drop_index('idx_calculation_laboratory', table_name='calculations', schema=SCHEMA)
    op.drop_index('idx_calculation_department', table_name='calculations', schema=SCHEMA)
    op.drop_table('calculations', schema=SCHEMA)
    op.drop_index('unique_sample_registration_number_per_lab_dept', table_name='samples', schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_index('idx_sample_laboratory', table_name='samples', schema=SCHEMA)
    op.drop_index('idx_sample_department', table_name='samples', schema=SCHEMA)
    op.drop_table('samples', schema=SCHEMA)
    op.drop_index('unique_well_mode_per_branch', table_name='well_modes', schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_table('well_modes', schema=SCHEMA)
    op.drop_index('unique_sampling_location_per_branch', table_name='sampling_locations', schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_table('sampling_locations', schema=SCHEMA)
    op.drop_table('research_method_groups_association', schema=SCHEMA)
    op.drop_index('idx_protocol_test_protocol_number', table_name='protocols', schema=SCHEMA)
    op.drop_index('idx_protocol_laboratory', table_name='protocols', schema=SCHEMA)
    op.drop_index('idx_protocol_department', table_name='protocols', schema=SCHEMA)
    op.drop_table('protocols', schema=SCHEMA)
    op.drop_index('idx_refraction_table_research_method_c', table_name='mass_fraction_oil_refraction_tables', schema=SCHEMA)
    op.drop_table('mass_fraction_oil_refraction_tables', schema=SCHEMA)
    op.drop_index('idx_selection_conditions_laboratory', table_name='selection_conditions', schema=SCHEMA)
    op.drop_index('idx_selection_conditions_department', table_name='selection_conditions', schema=SCHEMA)
    op.drop_table('selection_conditions', schema=SCHEMA)
    op.drop_index('idx_research_method_sort_order', table_name='research_methods', schema=SCHEMA)
    op.drop_index('idx_research_method_rounding_type', table_name='research_methods', schema=SCHEMA)
    op.drop_index('idx_research_method_name', table_name='research_methods', schema=SCHEMA)
    op.drop_index('idx_research_method_laboratory', table_name='research_methods', schema=SCHEMA)
    op.drop_index('idx_research_method_department', table_name='research_methods', schema=SCHEMA)
    op.drop_table('research_methods', schema=SCHEMA)
    op.drop_index('idx_report_template_type', table_name='report_templates', schema=SCHEMA)
    op.drop_index('idx_report_template_laboratory', table_name='report_templates', schema=SCHEMA)
    op.drop_index('idx_report_template_department', table_name='report_templates', schema=SCHEMA)
    op.drop_table('report_templates', schema=SCHEMA)
    op.drop_index('idx_protocol_template_name', table_name='protocol_templates', schema=SCHEMA)
    op.drop_index('idx_protocol_template_laboratory', table_name='protocol_templates', schema=SCHEMA)
    op.drop_index('idx_protocol_template_department', table_name='protocol_templates', schema=SCHEMA)
    op.drop_table('protocol_templates', schema=SCHEMA)
    op.drop_index('idx_nd_norm_test_object', table_name='nd_norms', schema=SCHEMA)
    op.drop_index('idx_nd_norm_name', table_name='nd_norms', schema=SCHEMA)
    op.drop_table('nd_norms', schema=SCHEMA)
    op.drop_index('idx_equipment_verification_end_date', table_name='equipments', schema=SCHEMA)
    op.drop_index('idx_equipment_type', table_name='equipments', schema=SCHEMA)
    op.drop_index('idx_equipment_name', table_name='equipments', schema=SCHEMA)
    op.drop_table('equipments', schema=SCHEMA)
    op.drop_index('idx_branch_name', table_name='branches', schema=SCHEMA)
    op.drop_index('idx_branch_laboratory', table_name='branches', schema=SCHEMA)
    op.drop_index('idx_branch_department', table_name='branches', schema=SCHEMA)
    op.drop_table('branches', schema=SCHEMA)
    op.drop_index('unique_department_name_per_laboratory', table_name='departments', schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_table('departments', schema=SCHEMA)
    op.drop_index('unique_test_object_name', table_name='test_objects', schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_index('idx_test_object_tag', table_name='test_objects', schema=SCHEMA)
    op.drop_table('test_objects', schema=SCHEMA)
    op.drop_index('unique_role_name_type', table_name='roles', schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_table('roles', schema=SCHEMA)
    op.drop_index('idx_research_method_group_sort_order', table_name='research_method_groups', schema=SCHEMA)
    op.drop_index('idx_research_method_group_name', table_name='research_method_groups', schema=SCHEMA)
    op.drop_table('research_method_groups', schema=SCHEMA)
    op.drop_index('unique_laboratory_name', table_name='laboratories', schema=SCHEMA, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_table('laboratories', schema=SCHEMA)
