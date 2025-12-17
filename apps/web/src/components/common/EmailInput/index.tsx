import type { ReactElement } from 'react'
import { TextField, type TextFieldProps } from '@mui/material'
import { useFormContext, type Validate, get } from 'react-hook-form'
import { validateEmailAddress } from '@safe-global/utils/utils/validation'
import useDebounce from '@/hooks/useDebounce'
import inputCss from '@/styles/inputs.module.css'

export type EmailInputProps = TextFieldProps & {
  email: string
  validate?: Validate<string>
  deps?: string | string[]
}

const EmailInput = ({ email, required = true, deps, ...props }: EmailInputProps): ReactElement => {
  const {
    register,
    formState: { errors },
  } = useFormContext()

  // Get field errors and debounce them
  const fieldError = get(errors, email)
  const debouncedFieldError = useDebounce(fieldError, 500)
  const error = fieldError ? debouncedFieldError : undefined

  return (
    <TextField
      {...props}
      className={inputCss.input}
      autoComplete="off"
      autoFocus={props.focused}
      label={<>{error?.message || props.label || ''}</>}
      error={!!error}
      fullWidth
      spellCheck={false}
      InputProps={props.InputProps || {}}
      InputLabelProps={{
        ...(props.InputLabelProps || {}),
        shrink: true,
      }}
      {...register(email, {
        deps,
        required,
        validate: (value: string) => {
          if (value) {
            return validateEmailAddress(value)
          }
        },
      })}
    />
  )
}

export default EmailInput
