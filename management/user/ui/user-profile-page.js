/*
 * user profiles
 */
import { Me, init_authentication_interceptors } from "../../ui-common/authentication.js";
import { AuthenticationError } from "../../ui-common/exceptions.js";
import page_layout from "../../ui-common/page-layout.js";
import page_header from "../../ui-common/page-header.js";
import bi from "../../ui-common/bi-components.js";
import error_msgs from "../../ui-common/error-msgs-component.js";
import login from "../../ui-common/login-component.js";


/* setup */
init_authentication_interceptors();


/* create vue */
export default new Vue({
    el: '#user_profile_page',
    
    components: {
        'page-layout': page_layout,
        'page-header': page_header,
        'bi': bi,
        'error-msgs': error_msgs,
        'login': login
    },
        
    data: {
        /* state from server */
        me: null,

        /* change password models */
        old_password: '',
        new_password: '',
        old_password_error: '',
        new_password_error: '',
        change_password_error: '',
        change_password_success: false,

        /* enable mfa totp models */
        totp_label: '',
        totp_token: '',
        mfa_error: '',

        /* disable mfa models */
        mfa_disable_password: '',
        mfa_disable_totp_token: '',
        
        /* other ui state */
        cur_tab: '',
        loading: 0,
    },

    updated: function() {        
        if (this.me==null && this.loading==0) {
            this.retrieve_state();
        }
    },
        
    methods: {

        logout: function() {
            this.reset_form();
            this.me = null;
        },

        login_success: function() {
            this.retrieve_state();
            this.reset_form();
        },

        reset_form: function() {
            this.$refs.error_msgs.hide_errors();
            
            /* change password models */
            this.old_password = '';
            this.new_password = '';
            this.old_password_error = '';
            this.new_password_error = '';
            this.change_password_error = '';
            this.change_password_success = false;

            /* enable mfa totp models */
            this.totp_label = '';
            this.totp_token = '';
            this.mfa_error = '';

            /* disable mfa models */
            this.mfa_disable_password = '';
            this.mfa_disable_totp_token = '';
        },

        set_tab: function(name) {
            this.cur_tab = ( name == this.cur_tab ? '': name);
        },

        change_password: function() {
            // reset errors
            this.old_password_error = '';
            this.new_password_error = '';
            this.change_password_error = '';
            this.change_password_success = false;

            // validate
            if (this.old_password == '') {
                this.old_password_error = 'Please enter your current password';
                return;
            }
            if (this.new_password == '') {
                this.new_password_error = 'Please enter a new password';
                return;
            }
            if (this.old_password == this.new_password) {
                this.new_password_error = 'The passwords cannot be the same';
                return;
            }
            
            // change password
            axios.post('user/password', {
                old_password: this.old_password,
                new_password: this.new_password
            }).then((response) => {
                if (! response.data.success) {
                    if (response.data.reason_key == 'old_password') {
                        this.old_password_error = response.data.reason;
                    }
                    else if (response.data.reason_key == 'new_password') {
                        this.new_password_error = response.data.reason;
                    }
                    else {
                        this.change_password_error = response.data.reason;
                    }
                }
                else {
                    // success - clear form
                    this.old_password = '';
                    this.new_password = '';
                    this.change_password_success = true;
                }
            }).catch((error) => {
                if (error instanceof AuthenticationError) {
                    this.reset_form();
                    this.$refs.error_msgs.set_error('' + error);
                    this.retrieve_state();
                }
                else {
                    this.change_password_error = '' + error;
                }
            });
        },


        friendly_mfa_label: function(label, quoted) {
            if (!label) return '[unnamed device]';
            return quoted ? '"'+label+'"' : label;
        },
        
        disable_mfa: function() {
            // reset errors
            this.mfa_error = '';

            // validate
            if (this.mfa_disable_password == '') {
                this.mfa_error = 'Please enter your current password';
                return;
            }

            var request_headers = {};
                
            if (this.me.enabled_mfa[0].type == 'totp') {
                if (this.mfa_disable_totp_token.trim() == '') {
                    var label=this.friendly_mfa_label(
                        this.me.enabled_mfa[0].label
                    );
                    this.mfa_error = `Please enter a 6-digit code from your authenticator app (hint: ${label})`;
                    return;
                }
                request_headers['X-Auth-Token'] = this.mfa_disable_totp_token;
            }
                    

            // disable all MFA
            axios.post('user/mfa/disable', {
                'mfa-id': null,
                password: this.mfa_disable_password,
            }, {
                headers: request_headers
            }).then((response) => {
                if (response.data.success) {
                    this.retrieve_state().then(() => {
                        this.cur_tab = 'enable_mfa';
                    });
                }
                else {
                    this.mfa_disable_totp_token = '';
                    this.mfa_error = response.data.reason;
                    if (response.data.reason == 'invalid-totp-token') {
                        this.mfa_error = 'The code is not valid, please try again';
                    }
                }
            }).catch((error) => {
                if (error instanceof AuthenticationError) {
                    this.reset_form();
                    this.$refs.error_msgs.set_error('' + error);
                    this.retrieve_state();
                }
                else {
                    this.mfa_error = '' + error;
                }
            });
        },


        enable_mfa_totp: function() {
            // reset errors
            this.mfa_error = '';

            // validate
            if (this.totp_token.trim() == '') {
                this.mfa_error = 'A six-digit code is required';
                return;
            }

            // enable TOTP
            axios.post('user/mfa/totp/enable', {
                secret: this.me.new_mfa.totp.secret,
                token: this.totp_token,
                label: this.totp_label
            }).then((response) => {
                if (response.data.success) {
                    this.retrieve_state().then(() => {
                        this.cur_tab = 'disable_mfa';
                    });
                }
                else {
                    this.totp_token = '';
                    this.mfa_error = response.data.reason;
                }
            }).catch((error) => {
                if (error instanceof AuthenticationError) {
                    this.reset_form();
                    this.$refs.error_msgs.set_error('' + error);
                    this.retrieve_state();
                }
                else {
                    this.mfa_error = '' + error;
                    this.totp_token = '';
                }
            })
        },
        
        
        /*
         * Retrieve the authentication state of the server for the
         * session and obtain other display info. Is the user logged
         * in?
         */
        retrieve_state: function() {
            ++this.loading;
            var promise =
                axios.get('user/me', { params: { mfa_state:'y' }}).then(response => {
                    this.me = new Me(response.data);
                    
                }).catch(error => {
                    this.$refs.error_msgs.set_error('' + error);
                    
                }).finally(() => {
                    --this.loading;
                });
            return promise;
        },
        
    }
});